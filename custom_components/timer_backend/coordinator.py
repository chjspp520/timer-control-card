"""DataUpdateCoordinator for Timer Backend."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.event import async_track_point_in_time
from homeassistant.util import dt as dt_util

from .const import (
    DOMAIN,
    SIGNAL_UPDATE_SENSOR,
    CONF_DEFAULT_ACTIONS,
    DEFAULT_TIME_ZONE,
    MAX_HISTORY_RECORDS,
)

_LOGGER = logging.getLogger(__name__)


class RepeatType(Enum):
    """重复类型枚举"""

    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"


class TimerBackendCoordinator:
    """定时任务协调器 - 包含空调支持的全自动版本，支持周期定时"""

    def __init__(
        self,
        hass: HomeAssistant,
        persist_file: str,
        time_zone: str,
        default_actions: dict,
    ) -> None:
        """初始化协调器."""
        self.hass = hass
        self.persist_file = persist_file
        self.time_zone = time_zone
        self.default_actions = default_actions

        # 空调相关配置
        self.climate_config = {
            "default_temperature": 25.0,
            "default_mode": "cool",
            "restore_previous": True,  # 是否恢复之前的设置
            "save_state_on_timer": True,  # 定时时保存当前状态
        }

        # 窗帘相关配置
        self.cover_config = {
            "default_position": 50,  # 默认位置（百分比）
            "restore_previous": True,  # 是否恢复之前的设置
            "save_state_on_timer": True,  # 定时时保存当前状态
        }

        # 存储
        self.tasks: Dict[str, Any] = {}
        self.timers: Dict[str, Any] = {}
        self.recurring_timers: Dict[str, Any] = {}  # 周期定时器句柄
        self.entity_timers: Dict[str, str] = {}  # 按实体ID索引的定时器
        self.climate_previous_states: Dict[str, Any] = {}  # 保存空调之前的状态
        self.cover_previous_states: Dict[str, Any] = {}  # 保存窗帘之前的状态
        self.history_tasks: List[Dict[str, Any]] = []  # 历史任务列表（兼容旧数据，不再使用）

        # 统计数据
        self.stats = {
            "total_task": 0,
            "successful_task": 0,
            "failed_task": 0,
            "today_task": 0,
        }

        # 上次保存时间戳（用于频率限制）
        self._last_save_timestamp: Optional[datetime] = None

        # 延迟更新实体（文件写入后2秒更新实体）
        self._delayed_update_unsub: Optional[Callable] = None  # 延迟更新取消句柄

        # 时区 - 使用dt_util获取，避免阻塞调用
        try:
            self.tz = dt_util.get_time_zone(time_zone)
            if self.tz is None:
                _LOGGER.warning(f"Invalid time zone: {time_zone}, using system timezone")
                self.tz = dt_util.DEFAULT_TIME_ZONE
        except:
            _LOGGER.warning(f"Invalid time zone: {time_zone}, using system timezone")
            self.tz = dt_util.DEFAULT_TIME_ZONE

    async def async_setup(self) -> None:
        """Setup coordinator."""
        # 监听事件
        self.hass.bus.async_listen("timer_backend_event", self.handle_frontend_event)

        # 监听空调状态变化
        self.hass.bus.async_listen("state_changed", self._handle_state_changed)

        # 恢复任务（包含历史记录）
        await self.restore_tasks()

        # 更新统计数据
        await self.update_stats()

        # 初始化传感器
        await self._update_sensor()

        _LOGGER.info(f"Timer backend coordinator started (Timezone: {self.time_zone})")

    async def async_unload(self) -> None:
        """Unload coordinator."""
        # 取消延迟更新定时器
        if self._delayed_update_unsub:
            self._delayed_update_unsub()
            self._delayed_update_unsub = None

        # 取消所有定时器
        for timer_handle in self.timers.values():
            if timer_handle:
                timer_handle()

        for timer_handle in self.recurring_timers.values():
            if timer_handle:
                timer_handle()

        # 保存任务
        await self.save_tasks()

        _LOGGER.info("Timer backend coordinator stopped")

    def get_local_now(self) -> datetime:
        """获取本地时区的当前时间."""
        return dt_util.now(self.tz)

    def parse_local_time(self, time_str: str, date_obj: datetime = None) -> datetime:
        """解析本地时间字符串为datetime对象."""
        if not date_obj:
            date_obj = self.get_local_now()

        # 解析时间字符串
        hour, minute, second = map(int, time_str.split(":"))

        # 创建本地时间
        return date_obj.replace(hour=hour, minute=minute, second=second, microsecond=0)

    def datetime_to_iso(self, dt: datetime) -> str:
        """将datetime转换为ISO格式字符串（返回本地时区时间）."""
        if dt.tzinfo is None:
            # 如果没有时区信息，假设为本地时区
            dt = dt.replace(tzinfo=self.tz)
        # 转换为本地时区并返回ISO格式（不带Z后缀，表示本地时间）
        local_dt = dt.astimezone(self.tz)
        return local_dt.strftime("%Y-%m-%dT%H:%M:%S")

    def convert_to_local_time_str(self, iso_str: str) -> str:
        """将ISO时间字符串转换为本地时区时间字符串（用于显示）."""
        if not iso_str:
            return ""
        try:
            dt = self.iso_to_datetime(iso_str)
            return self.datetime_to_iso(dt)
        except:
            return iso_str

    def iso_to_datetime(self, iso_str: str) -> datetime:
        """将ISO字符串转换为本地时区datetime."""
        try:
            # 如果字符串以Z结尾，说明是旧的UTC时间，需要转换为本地时区
            if iso_str.endswith("Z"):
                iso_str = iso_str.replace("Z", "+00:00")
                dt = datetime.fromisoformat(iso_str)
                # 从UTC转换为本地时区
                return dt.astimezone(self.tz)

            # 尝试解析为带时区的时间
            try:
                dt = datetime.fromisoformat(iso_str)
                if dt.tzinfo is None:
                    # 如果没有时区信息，假设为本地时区
                    dt = dt.replace(tzinfo=self.tz)
                else:
                    # 如果有时区信息，转换为本地时区
                    dt = dt.astimezone(self.tz)
                return dt
            except:
                pass

            # 尝试带T分隔符的格式（无时区）
            try:
                dt = datetime.strptime(iso_str, "%Y-%m-%dT%H:%M:%S")
                return dt.replace(tzinfo=self.tz)
            except:
                pass

            # 尝试其他格式（不带T的格式）
            dt = datetime.strptime(iso_str, "%Y-%m-%d %H:%M:%S")
            return dt.replace(tzinfo=self.tz)

        except Exception as e:
            _LOGGER.warning(f"Failed to parse datetime: {iso_str}, error: {e}")
            return self.get_local_now()

    async def ensure_file_exists(self) -> bool:
        """确保文件存在，如果不存在则创建."""
        try:
            # 确保目录存在
            directory = os.path.dirname(self.persist_file)
            if directory and not os.path.exists(directory):
                os.makedirs(directory, exist_ok=True)
                _LOGGER.info(f"Created directory: {directory}")

            # 如果文件不存在，创建空文件
            if not os.path.exists(self.persist_file):
                async with self.hass.async_add_executor_job(
                    lambda: open(self.persist_file, "w")
                ) as f:
                    json.dump({}, f, indent=2)
                _LOGGER.info(f"Created empty task file: {self.persist_file}")
                return True
            return False
        except Exception as e:
            _LOGGER.error(f"Failed to ensure file exists: {e}")
            return False

    async def save_tasks(self) -> None:
        """保存任务到文件（带频率限制）."""
        # 限制保存频率，避免频繁写入
        current_time = self.get_local_now()

        if self._last_save_timestamp is not None:
            time_diff = (current_time - self._last_save_timestamp).total_seconds()
            if time_diff < 5:  # 5秒内不重复保存
                _LOGGER.debug(f"Save skipped, last save was {time_diff:.1f}s ago")
                return

        try:
            # 确保文件存在
            await self.ensure_file_exists()

            # 准备保存的数据（直接保存 self.tasks）
            save_data = self.tasks.copy()

            # 保存文件
            def _save():
                with open(self.persist_file, "w", encoding="utf-8") as f:
                    json.dump(save_data, f, indent=2, default=str, ensure_ascii=False)

            await self.hass.async_add_executor_job(_save)

            _LOGGER.debug(f"Tasks saved to {self.persist_file}")
            self._last_save_timestamp = current_time

            # 安排2秒后更新实体（从文件重新加载）
            self._schedule_delayed_entity_update()

        except Exception as e:
            _LOGGER.error(f"Failed to save tasks: {e}")
            # 尝试创建文件后重试
            try:
                await self.ensure_file_exists()

                save_data = self.tasks.copy()

                def _retry_save():
                    with open(self.persist_file, "w", encoding="utf-8") as f:
                        json.dump(save_data, f, indent=2, default=str, ensure_ascii=False)

                await self.hass.async_add_executor_job(_retry_save)
                _LOGGER.info(f"Tasks saved after file creation: {self.persist_file}")
                self._last_save_timestamp = current_time

                # 安排2秒后更新实体
                self._schedule_delayed_entity_update()

            except Exception as retry_error:
                _LOGGER.error(f"Failed to save after retry: {retry_error}")

    def _schedule_delayed_entity_update(self) -> None:
        """安排2秒后从文件重新加载并更新实体."""
        # 取消之前的延迟更新
        if self._delayed_update_unsub:
            self._delayed_update_unsub()
            self._delayed_update_unsub = None

        # 安排2秒后执行
        self._delayed_update_unsub = async_track_point_in_time(
            self.hass,
            self._delayed_update_entity,
            self.get_local_now() + timedelta(seconds=2)
        )
        _LOGGER.debug("Scheduled entity update in 2 seconds")

    async def _delayed_update_entity(self, now: datetime) -> None:
        """2秒后从文件重新加载并更新实体."""
        try:
            _LOGGER.debug("Executing delayed entity update from file")

            # 加载文件内容
            def _load():
                if os.path.exists(self.persist_file):
                    with open(self.persist_file, "r", encoding="utf-8") as f:
                        return json.load(f)
                return {}

            data = await self.hass.async_add_executor_job(_load)

            # 更新 self.tasks（保留内存中已有的新数据，只更新文件中的旧数据）
            old_count = len(self.tasks)
            # 注意：不再清空 self.tasks，而是合并更新
            for timer_id, timer_data in data.items():
                # 跳过旧版历史记录的特殊key
                if timer_id == "__history_records__":
                    if isinstance(timer_data, list):
                        for record in timer_data:
                            record_id = record.get("id")
                            if record_id and record_id not in self.tasks:
                                self.tasks[record_id] = record
                    continue

                # 如果内存中已有该任务，只更新缺失的字段（保留内存中的新数据）
                if timer_id in self.tasks:
                    existing_task = self.tasks[timer_id]
                    for key, value in timer_data.items():
                        if key not in existing_task:
                            existing_task[key] = value
                else:
                    # 内存中没有该任务，添加
                    self.tasks[timer_id] = timer_data

            new_count = len(self.tasks)
            _LOGGER.info(f"Delayed update: merged {new_count} tasks from file (was {old_count})")

            # 更新统计和传感器
            await self.update_stats()
            await self._update_sensor()

            # 发送事件通知前端
            self.hass.bus.fire("timer_backend_response", {
                "action": "tasks_reloaded",
                "source": "delayed_update",
                "task_count": new_count,
                "timestamp": self.datetime_to_iso(self.get_local_now())
            })

        except json.JSONDecodeError as e:
            _LOGGER.error(f"Failed to parse tasks file in delayed update: {e}")
        except Exception as e:
            _LOGGER.error(f"Failed to execute delayed entity update: {e}")
        finally:
            self._delayed_update_unsub = None

    async def restore_tasks(self) -> None:
        """恢复保存的任务."""
        try:
            # 确保文件存在
            await self.ensure_file_exists()

            if os.path.exists(self.persist_file):

                def _load():
                    with open(self.persist_file, "r", encoding="utf-8") as f:
                        return json.load(f)

                data = await self.hass.async_add_executor_job(_load)

                restored = 0
                recurring_restored = 0
                for timer_id, timer_data in data.items():
                    # 跳过旧版历史记录的特殊key（向后兼容）
                    if timer_id == "__history_records__":
                        # 旧版历史记录：将其中的记录合并到 self.tasks 中
                        if isinstance(timer_data, list):
                            for record in timer_data:
                                record_id = record.get("id")
                                if record_id and record_id not in self.tasks:
                                    self.tasks[record_id] = record
                            _LOGGER.info(f"Migrated {len(timer_data)} history records into tasks")
                        continue

                    # 检查是否为周期任务
                    repeat_type = timer_data.get("repeat_type", "none")
                    schedule_time = timer_data.get("schedule_time")

                    if repeat_type != "none" and schedule_time:
                        # 恢复周期任务
                        await self.restore_recurring_timer(timer_id, timer_data)
                        recurring_restored += 1
                    elif timer_data.get("status") == "active":
                        # 恢复一次性定时器
                        entity_id = timer_data["entity_id"]

                        # 检查是否过期（使用本地时区）
                        end_time = self.iso_to_datetime(timer_data["end_time"])
                        now = self.get_local_now()

                        if end_time > now:
                            remaining = (end_time - now).total_seconds()

                            # 安排定时器 - 使用lambda传递timer_id
                            if timer_data.get("is_climate"):
                                timer_handle = async_track_point_in_time(
                                    self.hass,
                                    lambda now: self.execute_climate_timer(now, timer_id),
                                    end_time,
                                )
                            elif timer_data.get("is_cover"):
                                timer_handle = async_track_point_in_time(
                                    self.hass,
                                    lambda now: self.execute_cover_timer(now, timer_id),
                                    end_time,
                                )
                            else:
                                timer_handle = async_track_point_in_time(
                                    self.hass,
                                    lambda now: self.execute_timer(now, timer_id),
                                    end_time,
                                )

                            self.timers[timer_id] = timer_handle

                            # 安排预捕获：在执行前10秒获取 before_entity_state
                            start_time = self.iso_to_datetime(timer_data["start_time"])
                            pre_time = end_time - timedelta(seconds=10)
                            if pre_time > start_time:
                                pre_handle = async_track_point_in_time(
                                    self.hass,
                                    lambda now: self._pre_capture_state(now, timer_id),
                                    pre_time,
                                )
                                self.timers[f"{timer_id}_pre"] = pre_handle

                            self.entity_timers[entity_id] = timer_id
                            self.tasks[timer_id] = timer_data
                            restored += 1
                        else:
                            # 定时器在关机期间到期，立即执行
                            _LOGGER.info(f"Timer {timer_id} expired during downtime, executing now")
                            self.tasks[timer_id] = timer_data
                            # 使用后台任务异步执行，不阻塞恢复流程
                            if timer_data.get("is_climate"):
                                self.hass.async_create_task(self._async_execute_climate_timer(timer_id))
                            elif timer_data.get("is_cover"):
                                self.hass.async_create_task(self._async_execute_cover_timer(timer_id))
                            else:
                                self.hass.async_create_task(self._async_execute_timer(timer_id))
                    else:
                        # 非活跃的一次性任务（completed, cancelled, expired 等）
                        # 仍然添加到 self.tasks，以便在 all_task_list 中显示
                        self.tasks[timer_id] = timer_data
                        _LOGGER.debug(f"Restored non-active one-time task {timer_id} with status {timer_data.get('status')}")

                await self.save_tasks()
                _LOGGER.info(f"Restored {restored} timers and {recurring_restored} recurring schedules")

            else:
                _LOGGER.info("No task file found, starting with empty tasks")
                self.tasks = {}

        except json.JSONDecodeError:
            _LOGGER.warning("Task file is empty or corrupted, starting fresh")
            self.tasks = {}
            await self.save_tasks()
        except Exception as e:
            _LOGGER.error(f"Failed to restore tasks: {e}")
            self.tasks = {}

    async def restore_recurring_timer(self, timer_id: str, timer_data: dict) -> None:
        """恢复周期定时器."""
        try:
            repeat_type = timer_data.get("repeat_type")
            schedule_time = timer_data.get("schedule_time")

            if not repeat_type or not schedule_time:
                return

            # 保存任务数据
            self.tasks[timer_id] = timer_data

            # 只有活跃状态的周期任务才需要重新安排
            if timer_data.get("status") == "active":
                # 重新安排周期任务
                await self.schedule_recurring_timer(timer_id, timer_data)
                _LOGGER.debug(f"Restored active recurring timer: {timer_id} - {repeat_type} at {schedule_time}")
            else:
                _LOGGER.debug(f"Restored non-active recurring timer: {timer_id} - status: {timer_data.get('status')}")

        except Exception as e:
            _LOGGER.error(f"Failed to restore recurring timer: {e}")

    async def _handle_state_changed(self, event) -> None:
        """Handle state changed events."""
        entity_id = event.data.get("entity_id")
        if entity_id and entity_id.startswith("climate."):
            await self.handle_climate_state_change(entity_id)
        elif entity_id and entity_id.startswith("cover."):
            await self.handle_cover_state_change(entity_id)

    async def handle_climate_state_change(self, entity_id: str) -> None:
        """监听空调状态变化，保存之前的设置."""
        if entity_id not in self.climate_previous_states:
            # 保存当前完整状态
            state = self.hass.states.get(entity_id)
            if state:
                self.climate_previous_states[entity_id] = {
                    "hvac_mode": state.attributes.get("hvac_mode"),
                    "temperature": state.attributes.get("temperature"),
                    "fan_mode": state.attributes.get("fan_mode"),
                    "swing_mode": state.attributes.get("swing_mode"),
                    "preset_mode": state.attributes.get("preset_mode"),
                    "saved_at": self.datetime_to_iso(self.get_local_now()),
                }

    async def handle_cover_state_change(self, entity_id: str) -> None:
        """监听窗帘状态变化，保存之前的设置."""
        if entity_id not in self.cover_previous_states:
            # 保存当前完整状态
            state = self.hass.states.get(entity_id)
            if state:
                self.cover_previous_states[entity_id] = {
                    "state": state.state,  # open, closed, opening, closing
                    "current_position": state.attributes.get("current_position", 0),
                    "saved_at": self.datetime_to_iso(self.get_local_now()),
                }

    async def handle_frontend_event(self, event) -> None:
        """处理前端事件."""
        data = event.data
        action = data.get("action")

        if action == "create_timer":
            await self.create_timer(data)
        elif action == "get_all_timers":
            await self.send_all_timers(data.get("user_id"))
        elif action == "cancel_timer":
            await self.cancel_timer(data.get("timer_id"))
        elif action == "cancel_entity_timer":
            await self.cancel_entity_timer(data.get("entity_id"), data.get("user_id"))
        elif action == "create_climate_timer":
            await self.create_climate_timer(data)
        elif action == "create_cover_timer":
            await self.create_cover_timer(data)
        elif action == "create_schedule":
            await self.create_schedule(data)
        elif action == "cancel_schedule":
            await self.cancel_schedule(data.get("schedule_id"))
        elif action == "get_all_schedules":
            await self.send_all_schedules(data.get("user_id"))
        elif action == "clear_all_history":
            await self.clear_all_history()

    async def clear_all_history(self) -> None:
        """清除所有历史记录."""
        try:
            # 清除 tasks 中已完成/已取消/已过期的任务，只保留活跃任务
            active_tasks = {}
            for task_id, task_data in self.tasks.items():
                if task_data.get("status") == "active":
                    active_tasks[task_id] = task_data

            self.tasks = active_tasks

            # 更新统计
            await self.update_stats()

            # 保存到文件
            await self.save_tasks()

            # 更新传感器
            await self._update_sensor()

            _LOGGER.info("All history records cleared")

        except Exception as e:
            _LOGGER.error(f"Failed to clear all history: {e}")

    async def create_timer(self, data: dict) -> None:
        """创建通用定时器."""
        try:
            entity_id = data.get("entity_id")
            duration_str = data.get("duration", "00:30:00")

            if not entity_id:
                raise ValueError("Entity ID is required")

            # 检查实体是否存在
            if self.hass.states.get(entity_id) is None:
                raise ValueError(f"Entity {entity_id} does not exist")

            # 特殊处理空调
            if entity_id.startswith("climate."):
                return await self.create_climate_timer(data)

            # 特殊处理窗帘
            if entity_id.startswith("cover."):
                return await self.create_cover_timer(data)

            # 解析时长
            duration = self.parse_duration(duration_str)

            # 如果实体已有定时器，先取消
            if entity_id in self.entity_timers:
                await self.cancel_entity_timer(entity_id, data.get("user_id"))

            # 生成ID
            timer_id = str(uuid.uuid4())

            # 计算时间（使用本地时区）
            start_time = self.get_local_now()
            end_time = start_time + duration

            # 获取实体状态
            entity_state = self.hass.states.get(entity_id)
            state = entity_state.state if entity_state else "unknown"

            # 创建任务数据
            timer_data = {
                "timer_id": timer_id,
                "entity_id": entity_id,
                "duration": duration_str,
                "start_time": self.datetime_to_iso(start_time),
                "end_time": self.datetime_to_iso(end_time),
                "status": "active",
                "entity_name": self.get_friendly_name(entity_id),
                "entity_state": state,
                "domain": entity_id.split(".")[0],
                "created_by": data.get("user_id", "unknown"),
                "created_at": self.datetime_to_iso(self.get_local_now()),
                "action": self.generate_action(entity_id, data.get("action_type", "auto")),
                "repeat_type": "none",
                "is_recurring": False,
            }

            # 设置定时器 - 使用lambda传递timer_id
            timer_handle = async_track_point_in_time(
                self.hass, lambda now: self.execute_timer(now, timer_id), end_time
            )

            # 安排预捕获：在定时器到期前10秒提前获取 before_entity_state
            pre_time = end_time - timedelta(seconds=10)
            if pre_time > start_time:
                pre_handle = async_track_point_in_time(
                    self.hass, lambda now: self._pre_capture_state(now, timer_id), pre_time
                )
                self.timers[f"{timer_id}_pre"] = pre_handle

            # 保存
            self.timers[timer_id] = timer_handle
            self.entity_timers[entity_id] = timer_id
            self.tasks[timer_id] = timer_data
            await self.save_tasks()
            await self._update_sensor()

            # 发送响应事件
            response_data = {
                "action": "timer_created",
                "timer_id": timer_id,
                "entity_id": entity_id,
                "entity_name": timer_data["entity_name"],
                "duration": duration_str,
                "end_time": self.datetime_to_iso(end_time),
                "status": "active",
                "action_description": self.get_action_description(timer_data["action"]),
                "message": f"Timer set for {timer_data['entity_name']}",
                "time_zone": self.time_zone,
            }

            self.hass.bus.fire("timer_backend_response", response_data)

            # 广播 timers_list 通知所有卡片刷新
            await self.send_all_timers()

            _LOGGER.info(f"Timer created: {entity_id} - {duration_str}")

        except Exception as e:
            _LOGGER.error(f"Failed to create timer: {e}")
            self.hass.bus.fire(
                "timer_backend_response",
                {
                    "action": "error",
                    "error": str(e),
                    "success": False,
                },
            )

    async def create_climate_timer(self, data: dict) -> None:
        """创建空调专用定时器."""
        try:
            entity_id = data.get("entity_id")
            duration_str = data.get("duration", "01:00:00")  # 空调默认1小时
            action_type = data.get("action_type", "turn_off")

            if not entity_id:
                raise ValueError("Climate entity ID is required")

            # 检查是否为空调实体
            if not entity_id.startswith("climate."):
                raise ValueError("Climate entity required")

            if self.hass.states.get(entity_id) is None:
                raise ValueError(f"Climate entity {entity_id} does not exist")

            # 检查是否为周期任务
            repeat_type = data.get("repeat_type", "none")
            schedule_time = data.get("schedule_time")

            if repeat_type != "none" and schedule_time:
                # 创建周期定时任务
                return await self.create_schedule(data)

            # 解析时长
            duration = self.parse_duration(duration_str)

            # 如果实体已有定时器，先取消
            if entity_id in self.entity_timers:
                await self.cancel_entity_timer(entity_id, data.get("user_id"))

            # 生成ID
            timer_id = str(uuid.uuid4())

            # 计算时间（使用本地时区）
            start_time = self.get_local_now()
            end_time = start_time + duration

            # 获取当前空调状态
            state = self.hass.states.get(entity_id)
            current_attrs = state.attributes if state else {}
            current_state = state.state if state else "off"

            # 保存当前状态（用于恢复）
            if self.climate_config["save_state_on_timer"]:
                self.climate_previous_states[entity_id] = {
                    "hvac_mode": current_attrs.get("hvac_mode", "off"),
                    "temperature": current_attrs.get("temperature"),
                    "fan_mode": current_attrs.get("fan_mode"),
                    "swing_mode": current_attrs.get("swing_mode"),
                    "preset_mode": current_attrs.get("preset_mode"),
                    "current_temperature": current_attrs.get("current_temperature"),
                    "saved_at": self.datetime_to_iso(self.get_local_now()),
                }

            # 生成空调动作
            action = self.generate_climate_action(
                entity_id, action_type, data.get("action_data", {})
            )

            # 创建任务数据
            timer_data = {
                "timer_id": timer_id,
                "entity_id": entity_id,
                "duration": duration_str,
                "start_time": self.datetime_to_iso(start_time),
                "end_time": self.datetime_to_iso(end_time),
                "status": "active",
                "entity_name": self.get_friendly_name(entity_id),
                "entity_state": current_state,
                "domain": "climate",
                "created_by": data.get("user_id", "unknown"),
                "created_at": self.datetime_to_iso(self.get_local_now()),
                "action": action,
                "previous_state": self.climate_previous_states.get(entity_id, {}),
                "is_climate": True,
                "repeat_type": "none",
                "is_recurring": False,
            }

            # 设置定时器 - 使用lambda传递timer_id
            timer_handle = async_track_point_in_time(
                self.hass, lambda now: self.execute_climate_timer(now, timer_id), end_time
            )

            # 保存
            self.timers[timer_id] = timer_handle
            self.entity_timers[entity_id] = timer_id
            self.tasks[timer_id] = timer_data
            await self.save_tasks()
            await self._update_sensor()

            # 发送响应事件
            response_data = {
                "action": "timer_created",
                "timer_id": timer_id,
                "entity_id": entity_id,
                "entity_name": timer_data["entity_name"],
                "duration": duration_str,
                "end_time": self.datetime_to_iso(end_time),
                "status": "active",
                "action_description": self.get_climate_action_description(action),
                "previous_mode": timer_data["previous_state"].get("hvac_mode", "Unknown"),
                "target_action": action_type,
                "message": f"Climate timer set for {timer_data['entity_name']}",
                "time_zone": self.time_zone,
            }

            self.hass.bus.fire("timer_backend_response", response_data)

            # 广播 timers_list 通知所有卡片刷新
            await self.send_all_timers()

            _LOGGER.info(f"Created climate timer: {entity_id} - {duration_str} - Action: {action_type}")

        except Exception as e:
            _LOGGER.error(f"Failed to create climate timer: {e}")
            self.hass.bus.fire(
                "timer_backend_response",
                {
                    "action": "error",
                    "error": str(e),
                    "success": False,
                },
            )

    async def create_cover_timer(self, data: dict) -> None:
        """创建窗帘专用定时器."""
        try:
            entity_id = data.get("entity_id")
            duration_str = data.get("duration", "00:30:00")  # 默认30分钟
            action_type = data.get("action_type", "close")
            action_data = data.get("action_data", {})

            if not entity_id:
                raise ValueError("Cover entity ID is required")

            # 检查是否为窗帘实体
            if not entity_id.startswith("cover."):
                raise ValueError("Cover entity required")

            if self.hass.states.get(entity_id) is None:
                raise ValueError(f"Cover entity {entity_id} does not exist")

            # 检查是否为周期任务
            repeat_type = data.get("repeat_type", "none")
            schedule_time = data.get("schedule_time")

            if repeat_type != "none" and schedule_time:
                # 创建周期定时任务
                return await self.create_schedule(data)

            # 解析时长
            duration = self.parse_duration(duration_str)

            # 如果实体已有定时器，先取消
            if entity_id in self.entity_timers:
                await self.cancel_entity_timer(entity_id, data.get("user_id"))

            # 生成ID
            timer_id = str(uuid.uuid4())

            # 计算时间（使用本地时区）
            start_time = self.get_local_now()
            end_time = start_time + duration

            # 获取当前窗帘状态
            state = self.hass.states.get(entity_id)
            current_attrs = state.attributes if state else {}
            current_state = state.state if state else "closed"

            # 保存当前状态（用于恢复）
            if self.cover_config["save_state_on_timer"]:
                self.cover_previous_states[entity_id] = {
                    "state": current_state,
                    "current_position": current_attrs.get("current_position", 0),
                    "saved_at": self.datetime_to_iso(self.get_local_now()),
                }

            # 生成窗帘动作
            action = self.generate_cover_action(
                entity_id, action_type, data.get("action_data", {})
            )

            # 创建任务数据
            timer_data = {
                "timer_id": timer_id,
                "entity_id": entity_id,
                "duration": duration_str,
                "start_time": self.datetime_to_iso(start_time),
                "end_time": self.datetime_to_iso(end_time),
                "status": "active",
                "entity_name": self.get_friendly_name(entity_id),
                "entity_state": current_state,
                "domain": "cover",
                "created_by": data.get("user_id", "unknown"),
                "created_at": self.datetime_to_iso(self.get_local_now()),
                "action": action,
                "previous_state": self.cover_previous_states.get(entity_id, {}),
                "is_cover": True,
                "repeat_type": "none",
                "is_recurring": False,
            }

            # 设置定时器 - 使用lambda传递timer_id
            timer_handle = async_track_point_in_time(
                self.hass, lambda now: self.execute_cover_timer(now, timer_id), end_time
            )

            # 保存
            self.timers[timer_id] = timer_handle
            self.entity_timers[entity_id] = timer_id
            self.tasks[timer_id] = timer_data
            await self.save_tasks()
            await self._update_sensor()

            # 发送响应事件
            response_data = {
                "action": "timer_created",
                "timer_id": timer_id,
                "entity_id": entity_id,
                "entity_name": timer_data["entity_name"],
                "duration": duration_str,
                "end_time": self.datetime_to_iso(end_time),
                "status": "active",
                "action_description": self.get_cover_action_description(action),
                "previous_position": timer_data["previous_state"].get("current_position", 0),
                "target_action": action_type,
                "message": f"Cover timer set for {timer_data['entity_name']}",
                "time_zone": self.time_zone,
            }

            self.hass.bus.fire("timer_backend_response", response_data)

            # 广播 timers_list 通知所有卡片刷新
            await self.send_all_timers()

            _LOGGER.info(f"Created cover timer: {entity_id} - {duration_str} - Action: {action_type}")

        except Exception as e:
            _LOGGER.error(f"Failed to create cover timer: {e}")
            self.hass.bus.fire(
                "timer_backend_response",
                {
                    "action": "error",
                    "error": str(e),
                    "success": False,
                },
            )

    async def create_schedule(self, data: dict) -> None:
        """创建周期定时任务."""
        try:
            entity_id = data.get("entity_id")
            repeat_type = data.get("repeat_type", "none")
            schedule_time = data.get("schedule_time")
            action_type = data.get("action_type", "auto")

            if not entity_id:
                raise ValueError("Entity ID is required")

            if repeat_type == "none":
                raise ValueError("Repeat type must be specified for schedule")

            if not schedule_time:
                raise ValueError("Schedule time must be specified")

            # 检查实体是否存在
            if self.hass.states.get(entity_id) is None:
                raise ValueError(f"Entity {entity_id} does not exist")

            # 生成ID
            schedule_id = str(uuid.uuid4())

            # 解析时间
            time_parts = schedule_time.split(":")
            if len(time_parts) != 3:
                raise ValueError("Schedule time must be in HH:MM:SS format")

            hour, minute, second = map(int, time_parts)

            # 获取实体状态
            entity_state = self.hass.states.get(entity_id)
            state = entity_state.state if entity_state else "unknown"

            # 创建任务数据
            schedule_data = {
                "schedule_id": schedule_id,
                "entity_id": entity_id,
                "repeat_type": repeat_type,
                "schedule_time": schedule_time,
                "status": "active",
                "entity_name": self.get_friendly_name(entity_id),
                "entity_state": state,
                "domain": entity_id.split(".")[0],
                "created_by": data.get("user_id", "unknown"),
                "created_at": self.datetime_to_iso(self.get_local_now()),
                "action_type": action_type,
                "action_data": data.get("action_data", {}),
                "is_recurring": True,
                "last_executed": None,
                "next_execution": None,
                "time_zone": self.time_zone,
            }

            # 处理特定类型的参数
            if repeat_type == "weekly":
                weekdays = data.get("weekdays", [])
                if not weekdays:
                    raise ValueError("Weekdays must be specified for weekly schedule")
                schedule_data["weekdays"] = weekdays

            elif repeat_type == "monthly":
                month_days = data.get("month_days", [])
                if not month_days:
                    raise ValueError("Month days must be specified for monthly schedule")
                schedule_data["month_days"] = month_days

            # 如果是空调，保存当前状态
            if entity_id.startswith("climate."):
                state = self.hass.states.get(entity_id)
                current_attrs = state.attributes if state else {}

                if self.climate_config["save_state_on_timer"]:
                    schedule_data["previous_state"] = {
                        "hvac_mode": current_attrs.get("hvac_mode", "off"),
                        "temperature": current_attrs.get("temperature"),
                        "fan_mode": current_attrs.get("fan_mode"),
                        "swing_mode": current_attrs.get("swing_mode"),
                        "preset_mode": current_attrs.get("preset_mode"),
                        "saved_at": self.datetime_to_iso(self.get_local_now()),
                    }
                schedule_data["is_climate"] = True
                schedule_data["is_cover"] = False
            elif entity_id.startswith("cover."):
                # 如果是窗帘，保存当前状态
                state = self.hass.states.get(entity_id)
                current_attrs = state.attributes if state else {}

                if self.cover_config["save_state_on_timer"]:
                    schedule_data["previous_state"] = {
                        "state": state.state,
                        "current_position": current_attrs.get("current_position", 0),
                        "saved_at": self.datetime_to_iso(self.get_local_now()),
                    }
                schedule_data["is_climate"] = False
                schedule_data["is_cover"] = True
            else:
                schedule_data["is_climate"] = False
                schedule_data["is_cover"] = False

            # 安排定时任务
            await self.schedule_recurring_timer(schedule_id, schedule_data)

            # 保存
            self.tasks[schedule_id] = schedule_data
            await self.save_tasks()
            await self._update_sensor()

            # 发送响应事件
            response_data = {
                "action": "schedule_created",
                "schedule_id": schedule_id,
                "entity_id": entity_id,
                "entity_name": schedule_data["entity_name"],
                "repeat_type": repeat_type,
                "schedule_time": schedule_time,
                "status": "active",
                "next_execution": schedule_data.get("next_execution"),
                "message": f"Schedule created for {schedule_data['entity_name']}",
                "time_zone": self.time_zone,
            }

            if repeat_type == "weekly":
                response_data["weekdays"] = schedule_data.get("weekdays", [])
            elif repeat_type == "monthly":
                response_data["month_days"] = schedule_data.get("month_days", [])

            self.hass.bus.fire("timer_backend_response", response_data)

            # 广播 timers_list 通知所有卡片刷新
            await self.send_all_timers()

            _LOGGER.info(f"Schedule created: {entity_id} - {repeat_type} at {schedule_time}")

        except Exception as e:
            _LOGGER.error(f"Failed to create schedule: {e}")
            self.hass.bus.fire(
                "timer_backend_response",
                {
                    "action": "error",
                    "error": str(e),
                    "success": False,
                },
            )

    async def schedule_recurring_timer(self, schedule_id: str, schedule_data: dict) -> None:
        """安排周期定时任务（使用本地时区）."""
        try:
            repeat_type = schedule_data["repeat_type"]
            schedule_time = schedule_data["schedule_time"]
            
            # 【调试】打印接收到的数据
            _LOGGER.info(f"[schedule_recurring_timer] schedule_id={schedule_id}, repeat_type={repeat_type}, schedule_time={schedule_time}")
            if repeat_type == "monthly":
                _LOGGER.info(f"[schedule_recurring_timer] month_days: {schedule_data.get('month_days')}")
            elif repeat_type == "weekly":
                _LOGGER.info(f"[schedule_recurring_timer] weekdays: {schedule_data.get('weekdays')}")

            # 计算下次执行时间（本地时区）
            next_execution = self.calculate_next_execution(
                repeat_type, schedule_time, schedule_data
            )
            
            _LOGGER.info(f"[schedule_recurring_timer] 计算出的next_execution: {next_execution}")

            if not next_execution:
                raise ValueError("无法计算下次执行时间")

            now = self.get_local_now()
            delay_seconds = (next_execution - now).total_seconds()

            if delay_seconds < 0:
                # 如果时间已过，重新计算
                await self.check_recurring_schedules()
                return

            # 取消已存在的定时器
            if schedule_id in self.recurring_timers:
                old_handle = self.recurring_timers[schedule_id]
                if old_handle:
                    old_handle()
            # 取消已存在的预捕获定时器
            pre_key = f"{schedule_id}_pre"
            if pre_key in self.recurring_timers:
                self.recurring_timers[pre_key]()
                del self.recurring_timers[pre_key]

            # 安排预捕获：在执行前10秒提前获取 before_entity_state
            pre_time = next_execution - timedelta(seconds=10)
            if pre_time > now:
                pre_handle = async_track_point_in_time(
                    self.hass, lambda now: self._pre_capture_state(now, schedule_id), pre_time
                )
                self.recurring_timers[pre_key] = pre_handle

            # 创建新定时器 - 使用lambda传递schedule_id
            timer_handle = async_track_point_in_time(
                self.hass, lambda now: self.execute_recurring_schedule(now, schedule_id), next_execution
            )

            # 保存定时器句柄和下次执行时间
            next_execution_iso = self.datetime_to_iso(next_execution)
            schedule_data["next_execution"] = next_execution_iso
            self.recurring_timers[schedule_id] = timer_handle

            _LOGGER.debug(
                f"Scheduled {repeat_type} task for {schedule_data['entity_id']} at {next_execution}"
            )

        except Exception as e:
            _LOGGER.error(f"Failed to schedule recurring timer: {e}")

    def calculate_next_execution(
        self, repeat_type: str, schedule_time: str, schedule_data: dict
    ) -> Optional[datetime]:
        """计算下次执行时间（本地时区）."""
        now = self.get_local_now()

        # 解析时间
        hour, minute, second = map(int, schedule_time.split(":"))

        if repeat_type == "daily":
            # 每日执行
            # 创建今天的时间
            today_time = self.parse_local_time(schedule_time, now)

            # 如果今天的时间已经过去，安排明天
            if today_time <= now:
                tomorrow = now + timedelta(days=1)
                result = self.parse_local_time(schedule_time, tomorrow)
                return result
            else:
                return today_time

        elif repeat_type == "weekly":
            # 每周执行
            weekdays = schedule_data.get("weekdays", [])
            if not weekdays:
                return None

            # 转换为数字（0=周一，6=周日）
            target_days = [self.parse_weekday(day) for day in weekdays]

            # 找到下一个符合条件的日期
            for day_offset in range(7):
                check_date = now + timedelta(days=day_offset)
                check_weekday = check_date.weekday()  # 0=周一，6=周日

                if check_weekday in target_days:
                    check_time = self.parse_local_time(schedule_time, check_date)
                    # 如果是今天且时间已过，继续找下一天
                    if day_offset == 0 and check_time <= now:
                        continue
                    return check_time

            return None

        elif repeat_type == "monthly":
            # 每月执行
            month_days = schedule_data.get("month_days", [])
            _LOGGER.info(f"[calculate_next_execution] monthly: month_days={month_days}, schedule_time={schedule_time}, now={now}")
            
            if not month_days:
                _LOGGER.warning(f"[calculate_next_execution] monthly: month_days 为空!")
                return None

            # 找到下一个符合条件的日期
            current_year = now.year
            current_month = now.month

            for month_offset in range(12):  # 最多检查12个月
                check_year = current_year + ((current_month - 1 + month_offset) // 12)
                check_month = ((current_month - 1 + month_offset) % 12) + 1

                # 获取该月的天数
                import calendar

                days_in_month = calendar.monthrange(check_year, check_month)[1]

                # 检查该月的每一天
                for day in month_days:
                    if day <= days_in_month:
                        # 创建日期对象
                        try:
                            check_date = datetime(check_year, check_month, day, 0, 0, 0, tzinfo=self.tz)
                            check_time = self.parse_local_time(schedule_time, check_date)

                            # 如果日期在当前时间之后，返回
                            if check_time > now:
                                return check_time
                        except:
                            continue

                # 如果不是第一个月，找到了就返回
                if month_offset > 0:
                    for day in month_days:
                        if day <= days_in_month:
                            try:
                                check_date = datetime(check_year, check_month, day, 0, 0, 0, tzinfo=self.tz)
                                return self.parse_local_time(schedule_time, check_date)
                            except:
                                continue

            return None

        return None

    def parse_weekday(self, weekday_str: str) -> int:
        """将星期字符串转换为数字（0=周一，6=周日）."""
        weekday_map = {
            "monday": 0,
            "mon": 0,
            "tuesday": 1,
            "tue": 1,
            "wednesday": 2,
            "wed": 2,
            "thursday": 3,
            "thu": 3,
            "friday": 4,
            "fri": 4,
            "saturday": 5,
            "sat": 5,
            "sunday": 6,
            "sun": 6,
        }

        weekday_lower = weekday_str.lower()
        return weekday_map.get(weekday_lower, 0)

    def execute_recurring_schedule(self, now, schedule_id: str, *args, **kwargs) -> None:
        """执行周期定时任务 - 使用线程安全的方式调度异步执行."""
        if schedule_id not in self.tasks:
            _LOGGER.warning(f"Schedule {schedule_id} not found")
            return

        # 使用线程安全的方式调度异步执行
        # 即使从其他线程调用也能安全工作
        try:
            asyncio.run_coroutine_threadsafe(
                self._async_execute_recurring_schedule(schedule_id), self.hass.loop
            )
        except RuntimeError:
            # 如果事件循环不可访问，直接执行（降级方案）
            _LOGGER.error(f"Cannot schedule schedule {schedule_id}: event loop not available")
            self.hass.async_create_task(self._async_execute_recurring_schedule(schedule_id))

    async def _async_execute_recurring_schedule(self, schedule_id: str) -> None:
        """异步执行周期定时任务."""
        if schedule_id not in self.tasks:
            _LOGGER.warning(f"Schedule {schedule_id} not found")
            return

        schedule_data = self.tasks[schedule_id]

        # 检查是否已禁用
        if schedule_data.get("status") != "active":
            _LOGGER.debug(f"Schedule {schedule_id} is not active, skipping execution")
            return

        entity_id = schedule_data["entity_id"]
        action_type = schedule_data.get("action_type", "auto")

        # 使用预捕获的 before_entity_state（在执行前10秒已捕获）
        # 如果没有预捕获，则在执行时获取
        before_entity_state = schedule_data.get("before_entity_state", "unknown")
        if before_entity_state == "unknown":
            before_state = self.hass.states.get(entity_id)
            before_entity_state = before_state.state if before_state else "unknown"

        try:
            # 记录执行时间
            schedule_data["last_executed"] = self.datetime_to_iso(self.get_local_now())

            # 执行动作
            success = False
            action = None

            if schedule_data.get("is_climate"):
                # 空调任务
                action_data = schedule_data.get("action_data", {})
                action = self.generate_climate_action(entity_id, action_type, action_data)

                if action["type"] == "service_call":
                    domain, service = action["service"].split(".")
                    service_data = action.get("data", {}).copy()

                    # 如果是恢复操作，使用保存的数据
                    if (
                        action_type == "restore_previous"
                        and "restore_data" in action
                    ):
                        restore_data = action["restore_data"]

                        # 恢复完整状态
                        if restore_data.get("temperature"):
                            await self.hass.services.async_call(
                                "climate",
                                "set_temperature",
                                {
                                    "entity_id": entity_id,
                                    "temperature": restore_data["temperature"],
                                },
                            )

                        if restore_data.get("fan_mode"):
                            await self.hass.services.async_call(
                                "climate",
                                "set_fan_mode",
                                {
                                    "entity_id": entity_id,
                                    "fan_mode": restore_data["fan_mode"],
                                },
                            )

                        # 最后设置模式
                        if restore_data.get("hvac_mode"):
                            await self.hass.services.async_call(
                                "climate",
                                "set_hvac_mode",
                                {
                                    "entity_id": entity_id,
                                    "hvac_mode": restore_data["hvac_mode"],
                                },
                            )
                        success = True
                    else:
                        # 普通服务调用
                        await self.hass.services.async_call(
                            domain, service, service_data
                        )
                        success = True
            elif schedule_data.get("is_cover"):
                # 窗帘任务
                action_data = schedule_data.get("action_data", {})
                action = self.generate_cover_action(entity_id, action_type, action_data)

                if action["type"] == "service_call":
                    domain, service = action["service"].split(".")
                    service_data = action.get("data", {}).copy()

                    # 如果是恢复操作，使用保存的数据
                    if (
                        action_type == "restore_previous"
                        and "restore_data" in action
                    ):
                        restore_data = action["restore_data"]

                        # 恢复位置
                        if "current_position" in restore_data:
                            position = restore_data["current_position"]
                            await self.hass.services.async_call(
                                "cover",
                                "set_cover_position",
                                {
                                    "entity_id": entity_id,
                                    "position": position,
                                },
                            )
                            success = True
                    else:
                        # 普通服务调用
                        await self.hass.services.async_call(
                            domain, service, service_data
                        )
                        success = True
            else:
                # 通用任务
                action = self.generate_action(entity_id, action_type)

                if action["type"] == "service_call":
                    domain, service = action["service"].split(".")
                    await self.hass.services.async_call(
                        domain, service, action.get("data", {})
                    )
                    success = True

            # 执行成功后等待2秒再获取 after_entity_state
            if success:
                await asyncio.sleep(2)

            # 获取执行后的实体状态
            after_state = self.hass.states.get(entity_id)
            after_entity_state = after_state.state if after_state else "unknown"

            # 记录历史
            await self.add_history_record(
                timer_id=schedule_id,
                entity_id=entity_id,
                entity_name=schedule_data.get("entity_name", entity_id),
                task_action=action.get("description", action.get("service", "unknown")) if action else "unknown",
                before_entity_state=before_entity_state,
                after_entity_state=after_entity_state,
                execution_result="success" if success else "failed",
                start_time=schedule_data.get("last_executed", ""),
                end_time="",
                creation_time=schedule_data.get("created_at", ""),
            )

            # 更新统计
            await self.update_stats()

            _LOGGER.debug(f"Executed recurring schedule: {schedule_id} - {entity_id}")

            # 发送执行通知
            self.hass.bus.fire(
                "timer_backend_response",
                {
                    "action": "schedule_executed",
                    "schedule_id": schedule_id,
                    "entity_id": entity_id,
                    "entity_name": schedule_data["entity_name"],
                    "repeat_type": schedule_data["repeat_type"],
                    "success": success,
                    "before_entity_state": before_entity_state,
                    "after_entity_state": after_entity_state,
                    "message": f"Recurring schedule executed for {schedule_data['entity_name']}",
                    "time_zone": self.time_zone,
                },
            )

            # 重新安排下次执行
            await self.reschedule_recurring_timer(schedule_id, schedule_data)

        except Exception as e:
            _LOGGER.error(f"Failed to execute recurring schedule: {e}")

            # 获取执行后的实体状态（失败时也要记录）
            after_state = self.hass.states.get(entity_id)
            after_entity_state = after_state.state if after_state else "unknown"

            # 记录失败历史
            await self.add_history_record(
                timer_id=schedule_id,
                entity_id=entity_id,
                entity_name=schedule_data.get("entity_name", entity_id),
                task_action=action.get("description", "unknown") if action else "unknown",
                before_entity_state=before_entity_state,
                after_entity_state=after_entity_state,
                execution_result="failed",
                start_time=schedule_data.get("last_executed", ""),
                end_time="",
                creation_time=schedule_data.get("created_at", ""),
            )

            # 更新统计
            await self.update_stats()

            # 仍然尝试重新安排
            try:
                await self.reschedule_recurring_timer(schedule_id, schedule_data)
            except Exception as reschedule_error:
                _LOGGER.error(f"Failed to reschedule after error: {reschedule_error}")

    async def reschedule_recurring_timer(self, schedule_id: str, schedule_data: dict) -> None:
        """重新安排周期定时任务."""
        try:
            # 计算下次执行时间（本地时区）
            schedule_time = schedule_data["schedule_time"]

            next_execution = self.calculate_next_execution(
                schedule_data["repeat_type"], schedule_time, schedule_data
            )

            if not next_execution:
                _LOGGER.warning(f"Cannot calculate next execution for schedule {schedule_id}")
                return

            now = self.get_local_now()
            delay_seconds = (next_execution - now).total_seconds()

            # 取消旧的定时器
            if schedule_id in self.recurring_timers:
                old_handle = self.recurring_timers[schedule_id]
                if old_handle:
                    old_handle()

            # 创建新定时器 - 使用lambda传递schedule_id
            if delay_seconds > 0:
                timer_handle = async_track_point_in_time(
                    self.hass, lambda now: self.execute_recurring_schedule(now, schedule_id), next_execution
                )

                self.recurring_timers[schedule_id] = timer_handle
                schedule_data["next_execution"] = self.datetime_to_iso(next_execution)

                # 清除上次预捕获的状态，以便下次预捕获时获取新状态
                if "before_entity_state" in schedule_data:
                    del schedule_data["before_entity_state"]

                _LOGGER.debug(
                    f"Rescheduled {schedule_data['repeat_type']} task for {schedule_data['entity_id']} at {next_execution}"
                )
            else:
                # 如果延迟为负数，安排到明天检查
                _LOGGER.debug(
                    f"Next execution is in the past for schedule {schedule_id}, will check tomorrow"
                )
                schedule_data["next_execution"] = None

            await self.save_tasks()

        except Exception as e:
            _LOGGER.error(f"Failed to reschedule recurring timer: {e}")

    async def check_recurring_schedules(self) -> None:
        """检查并重新安排所有周期任务（每日午夜执行，使用本地时区）."""
        try:
            _LOGGER.debug(
                f"Checking recurring schedules at {self.get_local_now()}..."
            )

            for schedule_id, schedule_data in self.tasks.items():
                if (
                    schedule_data.get("is_recurring")
                    and schedule_data.get("status") == "active"
                ):
                    # 检查是否需要重新安排
                    next_execution_str = schedule_data.get("next_execution")
                    if not next_execution_str:
                        # 重新安排
                        await self.schedule_recurring_timer(schedule_id, schedule_data)
                    else:
                        # 检查是否已过期
                        try:
                            next_execution = self.iso_to_datetime(next_execution_str)
                            now = self.get_local_now()
                            if next_execution <= now:
                                # 重新安排
                                await self.schedule_recurring_timer(
                                    schedule_id, schedule_data
                                )
                        except:
                            # 解析失败，重新安排
                            await self.schedule_recurring_timer(schedule_id, schedule_data)

            _LOGGER.debug("Recurring schedules check completed")

        except Exception as e:
            _LOGGER.error(f"Failed to check recurring schedules: {e}")

    def generate_climate_action(
        self, entity_id, action_type="turn_off", action_data=None
    ):
        """生成空调动作，优先使用default_actions配置."""
        action_data = action_data or {}
        
        # 检查default_actions中是否有自定义配置
        climate_actions = self.default_actions.get("climate", {})
        
        if action_type == "turn_off":
            # 优先使用default_actions中的配置
            if "turn_off" in climate_actions:
                action_cfg = climate_actions["turn_off"]
                return {
                    "type": "service_call",
                    "service": action_cfg["service"],
                    "data": {**action_cfg.get("data", {}), "entity_id": entity_id},
                    "description": action_cfg.get("description", "Turn off AC"),
                }
            # 默认动作
            return {
                "type": "service_call",
                "service": "climate.turn_off",
                "data": {"entity_id": entity_id},
                "description": "Turn off AC",
            }

        elif action_type == "set_temperature":
            # 优先使用default_actions中的配置
            if "set_temperature" in climate_actions:
                action_cfg = climate_actions["set_temperature"]
                temperature = action_data.get(
                    "temperature", self.climate_config["default_temperature"]
                )
                hvac_mode = action_data.get("hvac_mode", self.climate_config["default_mode"])
                
                return {
                    "type": "service_call",
                    "service": action_cfg["service"],
                    "data": {
                        **action_cfg.get("data", {}),
                        "entity_id": entity_id,
                        "temperature": temperature,
                        "hvac_mode": hvac_mode,
                    },
                    "description": action_cfg.get("description", f"Set temperature to {temperature}°C"),
                }
            
            # 默认动作
            temperature = action_data.get(
                "temperature", self.climate_config["default_temperature"]
            )
            hvac_mode = action_data.get("hvac_mode", self.climate_config["default_mode"])

            return {
                "type": "service_call",
                "service": "climate.set_temperature",
                "data": {
                    "entity_id": entity_id,
                    "temperature": temperature,
                    "hvac_mode": hvac_mode,
                },
                "description": f"Set temperature to {temperature}°C",
            }

        elif action_type == "set_mode":
            # 优先使用default_actions中的配置
            if "set_mode" in climate_actions:
                action_cfg = climate_actions["set_mode"]
                mode = action_data.get("mode", "cool")
                
                return {
                    "type": "service_call",
                    "service": action_cfg["service"],
                    "data": {
                        **action_cfg.get("data", {}),
                        "entity_id": entity_id,
                        "hvac_mode": mode,
                    },
                    "description": action_cfg.get("description", f"Set mode to {mode}"),
                }
            
            # 默认动作
            mode = action_data.get("mode", "cool")

            return {
                "type": "service_call",
                "service": "climate.set_hvac_mode",
                "data": {
                    "entity_id": entity_id,
                    "hvac_mode": mode,
                },
                "description": f"Set mode to {mode}",
            }

        elif action_type == "restore_previous":
            # 恢复之前的状态
            previous_state = self.climate_previous_states.get(entity_id, {})
            hvac_mode = previous_state.get("hvac_mode", "cool")
            
            # 优先使用default_actions中的配置
            if "restore_previous" in climate_actions:
                action_cfg = climate_actions["restore_previous"]
                return {
                    "type": "service_call",
                    "service": action_cfg["service"],
                    "data": {
                        **action_cfg.get("data", {}),
                        "entity_id": entity_id,
                        "hvac_mode": hvac_mode,
                    },
                    "restore_data": previous_state,
                    "description": action_cfg.get("description", f"Restore previous state ({hvac_mode})"),
                }

            return {
                "type": "service_call",
                "service": "climate.set_hvac_mode",
                "data": {
                    "entity_id": entity_id,
                    "hvac_mode": hvac_mode,
                },
                "restore_data": previous_state,
                "description": f"Restore previous state ({hvac_mode})",
            }

        elif action_type == "auto":
            # 智能判断：如果空调开着就关，如果关着就恢复之前状态或默认设置
            state = self.hass.states.get(entity_id)
            current_state = state.state if state else "off"
            if current_state == "off":
                return self.generate_climate_action(entity_id, "restore_previous")
            else:
                return self.generate_climate_action(entity_id, "turn_off")

        else:
            # 默认关闭
            return self.generate_climate_action(entity_id, "turn_off")

    def get_available_cover_service(self, preferred_service: str, fallback_service: str) -> str:
        """获取可用的窗帘服务，优先使用preferred_service，如果不可用则使用fallback_service."""
        try:
            domain, service = preferred_service.split(".")

            if self.hass.services.has_service(domain, service):
                return preferred_service
            else:
                # 尝试 fallback_service
                try:
                    _, fallback = fallback_service.split(".")
                    if self.hass.services.has_service(domain, fallback):
                        return fallback_service
                except:
                    pass

                # 返回 preferred_service，让调用者知道尝试失败了
                return preferred_service
        except Exception as e:
            return fallback_service

    def generate_cover_action(
        self, entity_id, action_type="close", action_data=None
    ):
        """生成窗帘动作，优先使用default_actions配置."""
        action_data = action_data or {}

        # 检查default_actions中是否有自定义配置
        cover_actions = self.default_actions.get("cover", {})

        if action_type == "close":
            # 优先使用default_actions中的配置
            if "close" in cover_actions:
                action_cfg = cover_actions["close"]
                # 优先尝试使用 _cover 后缀的服务名称
                service = self.get_available_cover_service(action_cfg["service"], "cover.close_cover")
                return {
                    "type": "service_call",
                    "service": service,
                    "data": {**action_cfg.get("data", {}), "entity_id": entity_id},
                    "description": action_cfg.get("description", "Close cover"),
                }
            # 默认动作 - 使用 close_cover
            service = self.get_available_cover_service("cover.close_cover", "cover.close")
            return {
                "type": "service_call",
                "service": service,
                "data": {"entity_id": entity_id},
                "description": "Close cover",
            }

        elif action_type == "open":
            # 优先使用default_actions中的配置
            if "open" in cover_actions:
                action_cfg = cover_actions["open"]
                # 优先尝试使用 _cover 后缀的服务名称
                service = self.get_available_cover_service(action_cfg["service"], "cover.open_cover")
                return {
                    "type": "service_call",
                    "service": service,
                    "data": {**action_cfg.get("data", {}), "entity_id": entity_id},
                    "description": action_cfg.get("description", "Open cover"),
                }
            # 默认动作 - 使用 open_cover
            service = self.get_available_cover_service("cover.open_cover", "cover.open")
            return {
                "type": "service_call",
                "service": service,
                "data": {"entity_id": entity_id},
                "description": "Open cover",
            }

        elif action_type == "set_position":
            # 优先使用default_actions中的配置
            if "set_position" in cover_actions:
                action_cfg = cover_actions["set_position"]
                # 优先使用action_data中的position，如果没有则读取实体的当前位置
                if "position" in action_data:
                    position = action_data["position"]
                else:
                    # 读取实体的当前位置
                    state = self.hass.states.get(entity_id)
                    position = state.attributes.get("current_position", 0) if state else 0

                # 优先尝试使用 _cover 后缀的服务名称
                service = self.get_available_cover_service(action_cfg["service"], "cover.set_cover_position")

                return {
                    "type": "service_call",
                    "service": service,
                    "data": {
                        **action_cfg.get("data", {}),
                        "entity_id": entity_id,
                        "position": position,
                    },
                    "description": action_cfg.get("description", f"Set cover position to {position}%"),
                }

            # 默认动作 - 使用 set_cover_position
            # 优先使用action_data中的position，如果没有则读取实体的当前位置
            if "position" in action_data:
                position = action_data["position"]
            else:
                # 读取实体的当前位置
                state = self.hass.states.get(entity_id)
                position = state.attributes.get("current_position", 0) if state else 0

            service = self.get_available_cover_service("cover.set_cover_position", "cover.set_position")

            return {
                "type": "service_call",
                "service": service,
                "data": {
                    "entity_id": entity_id,
                    "position": position,
                },
                "description": f"Set cover position to {position}%",
            }

        elif action_type == "restore_previous":
            # 恢复之前的状态
            previous_state = self.cover_previous_states.get(entity_id, {})
            previous_position = previous_state.get("current_position", 0)

            # 如果没有保存过状态，读取实体的当前位置
            if not previous_state or previous_position == 0:
                state = self.hass.states.get(entity_id)
                if state:
                    current_attrs = state.attributes if state else {}
                    previous_position = current_attrs.get("current_position", 0)

            # 优先使用default_actions中的配置
            if "set_position" in cover_actions:
                action_cfg = cover_actions["set_position"]
                # 优先尝试使用 _cover 后缀的服务名称
                service = self.get_available_cover_service(action_cfg["service"], "cover.set_cover_position")

                return {
                    "type": "service_call",
                    "service": service,
                    "data": {
                        **action_cfg.get("data", {}),
                        "entity_id": entity_id,
                        "position": previous_position,
                    },
                    "restore_data": previous_state,
                    "description": action_cfg.get("description", f"Restore previous position ({previous_position}%)"),
                }

            service = self.get_available_cover_service("cover.set_cover_position", "cover.set_position")

            return {
                "type": "service_call",
                "service": service,
                "data": {
                    "entity_id": entity_id,
                    "position": previous_position,
                },
                "restore_data": previous_state,
                "description": f"Restore previous position ({previous_position}%)",
            }

        elif action_type == "auto":
            # 智能判断：如果窗帘开着就关，如果关着就恢复之前状态或默认设置
            state = self.hass.states.get(entity_id)
            current_state = state.state if state else "closed"
            if current_state == "closed":
                return self.generate_cover_action(entity_id, "restore_previous")
            else:
                return self.generate_cover_action(entity_id, "close")

        else:
            # 默认关闭
            return self.generate_cover_action(entity_id, "close")

    def execute_cover_timer(self, now, timer_id: str, *args, **kwargs) -> None:
        """执行窗帘定时器 - 同步方法，内部使用线程安全的方式调用异步服务."""
        if timer_id in self.tasks:
            # 在事件循环中创建任务
            asyncio.run_coroutine_threadsafe(
                self._async_execute_cover_timer(timer_id), self.hass.loop
            )

    async def _async_execute_cover_timer(self, timer_id: str) -> None:
        """异步执行窗帘定时器."""
        if timer_id not in self.tasks:
            return

        timer = self.tasks[timer_id]
        entity_id = timer["entity_id"]

        # 检查定时器是否已被取消
        if timer.get("status") == "cancelled":
            _LOGGER.debug(f"Cover timer {timer_id} was cancelled, skipping execution")
            return

        # 使用预捕获的 before_entity_state（在定时器到期前10秒已捕获）
        # 如果没有预捕获，则在执行时获取
        before_entity_state = timer.get("before_entity_state", "unknown")
        if before_entity_state == "unknown":
            before_state = self.hass.states.get(entity_id)
            before_entity_state = before_state.state if before_state else "unknown"

        try:
            # 执行动作
            action = timer["action"]
            success = False

            if action["type"] == "service_call":
                # 检查service字段是否存在
                if "service" not in action:
                    raise ValueError(f"Action missing 'service' field: {action}")

                service_name = action["service"]

                # 分割domain和service
                if "." not in service_name:
                    raise ValueError(f"Invalid service name format (missing '.'): {service_name}")

                domain, service = service_name.split(".", 1)
                service_data = action.get("data", {}).copy()

                _LOGGER.info(f"Calling service: domain={domain}, service={service}, data={service_data}")

                # 检查服务是否可用
                if not self.hass.services.has_service(domain, service):
                    raise ValueError(f"Service {domain}.{service} not found in Home Assistant")

                # 调用服务，使用blocking=True确保服务执行完成
                try:
                    await self.hass.services.async_call(
                        domain, service, service_data, blocking=True
                    )
                    success = True
                except Exception as service_error:
                    _LOGGER.error(f"Service call failed for {domain}.{service}: {service_error}", exc_info=True)
                    raise
            else:
                _LOGGER.warning(f"Unknown action type: {action.get('type')}")

            # 执行成功后等待2秒再获取 after_entity_state
            if success:
                await asyncio.sleep(2)

            # 获取执行后的实体状态
            after_state = self.hass.states.get(entity_id)
            after_entity_state = after_state.state if after_state else "unknown"

            # 更新状态
            if success:
                timer["status"] = "completed"
                timer["executed_at"] = self.datetime_to_iso(self.get_local_now())
                timer["execution_result"] = "success"
            else:
                timer["status"] = "failed"
                timer["execution_result"] = "failed"

            # 记录历史
            await self.add_history_record(
                timer_id=timer_id,
                entity_id=entity_id,
                entity_name=timer.get("entity_name", entity_id),
                task_action=action.get("description", action.get("service", "unknown")),
                before_entity_state=before_entity_state,
                after_entity_state=after_entity_state,
                execution_result="success" if success else "failed",
                start_time=timer.get("start_time", ""),
                end_time=timer.get("end_time", ""),
                creation_time=timer.get("created_at", ""),
            )

            # 更新统计
            await self.update_stats()

            # 清理
            if entity_id in self.entity_timers:
                del self.entity_timers[entity_id]
            if timer_id in self.timers:
                del self.timers[timer_id]

            await self.save_tasks()
            await self._update_sensor()

            # 发送通知
            self.hass.bus.fire(
                "timer_backend_response",
                {
                    "action": "timer_completed",
                    "timer_id": timer_id,
                    "entity_id": entity_id,
                    "entity_name": timer["entity_name"],
                    "success": success,
                    "action_description": timer["action"].get("description", ""),
                    "before_entity_state": before_entity_state,
                    "after_entity_state": after_entity_state,
                    "message": f"Cover timer executed for {timer['entity_name']}",
                    "time_zone": self.time_zone,
                },
            )

            _LOGGER.info(
                f"Cover timer executed successfully: {entity_id} - {timer['action'].get('description', '')}"
            )

        except Exception as e:
            _LOGGER.error(f"Failed to execute cover timer: {e}", exc_info=True)
            timer["status"] = "error"
            timer["error"] = str(e)
            timer["execution_result"] = "failed"

            # 获取执行后的实体状态（失败时也要记录）
            after_state = self.hass.states.get(entity_id)
            after_entity_state = after_state.state if after_state else "unknown"

            # 记录失败历史
            await self.add_history_record(
                timer_id=timer_id,
                entity_id=entity_id,
                entity_name=timer.get("entity_name", entity_id),
                task_action=timer.get("action", {}).get("description", "unknown"),
                before_entity_state=before_entity_state,
                after_entity_state=after_entity_state,
                execution_result="failed",
                start_time=timer.get("start_time", ""),
                end_time=timer.get("end_time", ""),
                creation_time=timer.get("created_at", ""),
            )

            # 更新统计
            await self.update_stats()

            await self.save_tasks()
            await self._update_sensor()

    def execute_climate_timer(self, now, timer_id: str, *args, **kwargs) -> None:
        """执行空调定时器 - 同步方法，内部使用线程安全的方式调用异步服务."""
        if timer_id in self.tasks:
            # 在事件循环中创建任务
            asyncio.run_coroutine_threadsafe(
                self._async_execute_climate_timer(timer_id), self.hass.loop
            )

    async def _async_execute_climate_timer(self, timer_id: str) -> None:
        """异步执行空调定时器."""
        if timer_id not in self.tasks:
            return

        timer = self.tasks[timer_id]
        entity_id = timer["entity_id"]

        # 检查定时器是否已被取消
        if timer.get("status") == "cancelled":
            _LOGGER.debug(f"Climate timer {timer_id} was cancelled, skipping execution")
            return

        # 使用预捕获的 before_entity_state（在定时器到期前10秒已捕获）
        # 如果没有预捕获，则在执行时获取
        before_entity_state = timer.get("before_entity_state", "unknown")
        if before_entity_state == "unknown":
            before_state = self.hass.states.get(entity_id)
            before_entity_state = before_state.state if before_state else "unknown"

        try:
            # 执行动作
            action = timer["action"]
            success = False

            if action["type"] == "service_call":
                domain, service = action["service"].split(".")
                service_data = action.get("data", {}).copy()

                # 如果是恢复操作，使用保存的数据
                if (
                    timer.get("action_type") == "restore_previous"
                    and "restore_data" in action
                ):
                    restore_data = action["restore_data"]

                    # 恢复完整状态
                    if restore_data.get("temperature"):
                        await self.hass.services.async_call(
                            "climate",
                            "set_temperature",
                            {
                                "entity_id": entity_id,
                                "temperature": restore_data["temperature"],
                            },
                        )

                    if restore_data.get("fan_mode"):
                        await self.hass.services.async_call(
                            "climate",
                            "set_fan_mode",
                            {
                                "entity_id": entity_id,
                                "fan_mode": restore_data["fan_mode"],
                            },
                        )

                    # 最后设置模式
                    if restore_data.get("hvac_mode"):
                        await self.hass.services.async_call(
                            "climate",
                            "set_hvac_mode",
                            {
                                "entity_id": entity_id,
                                "hvac_mode": restore_data["hvac_mode"],
                            },
                        )

                    success = True
                else:
                    # 普通服务调用
                    await self.hass.services.async_call(
                        domain, service, service_data
                    )
                    success = True

            # 执行成功后等待2秒再获取 after_entity_state
            if success:
                await asyncio.sleep(2)

            # 获取执行后的实体状态
            after_state = self.hass.states.get(entity_id)
            after_entity_state = after_state.state if after_state else "unknown"

            # 更新状态
            if success:
                timer["status"] = "completed"
                timer["executed_at"] = self.datetime_to_iso(self.get_local_now())
                timer["execution_result"] = "success"
            else:
                timer["status"] = "failed"
                timer["execution_result"] = "failed"

            # 记录历史
            await self.add_history_record(
                timer_id=timer_id,
                entity_id=entity_id,
                entity_name=timer.get("entity_name", entity_id),
                task_action=action.get("description", action.get("service", "unknown")),
                before_entity_state=before_entity_state,
                after_entity_state=after_entity_state,
                execution_result="success" if success else "failed",
                start_time=timer.get("start_time", ""),
                end_time=timer.get("end_time", ""),
                creation_time=timer.get("created_at", ""),
            )

            # 更新统计
            await self.update_stats()

            # 清理
            if entity_id in self.entity_timers:
                del self.entity_timers[entity_id]
            if timer_id in self.timers:
                del self.timers[timer_id]

            await self.save_tasks()
            await self._update_sensor()

            # 发送通知
            self.hass.bus.fire(
                "timer_backend_response",
                {
                    "action": "timer_completed",
                    "timer_id": timer_id,
                    "entity_id": entity_id,
                    "entity_name": timer["entity_name"],
                    "success": success,
                    "action_description": timer["action"].get("description", ""),
                    "before_entity_state": before_entity_state,
                    "after_entity_state": after_entity_state,
                    "message": f"Climate timer executed for {timer['entity_name']}",
                    "time_zone": self.time_zone,
                },
            )

            _LOGGER.info(
                f"Climate timer executed successfully: {entity_id} - {timer['action'].get('description', '')}"
            )

        except Exception as e:
            _LOGGER.error(f"Failed to execute climate timer: {e}")
            timer["status"] = "error"
            timer["error"] = str(e)
            timer["execution_result"] = "failed"

            # 获取执行后的实体状态（失败时也要记录）
            after_state = self.hass.states.get(entity_id)
            after_entity_state = after_state.state if after_state else "unknown"

            # 记录失败历史
            await self.add_history_record(
                timer_id=timer_id,
                entity_id=entity_id,
                entity_name=timer.get("entity_name", entity_id),
                task_action=timer.get("action", {}).get("description", "unknown"),
                before_entity_state=before_entity_state,
                after_entity_state=after_entity_state,
                execution_result="failed",
                start_time=timer.get("start_time", ""),
                end_time=timer.get("end_time", ""),
                creation_time=timer.get("created_at", ""),
            )

            # 更新统计
            await self.update_stats()

            await self.save_tasks()
            await self._update_sensor()

    def generate_action(self, entity_id, action_type="auto", current_state=None):
        """根据实体类型自动生成动作，优先使用default_actions配置."""
        domain = entity_id.split(".")[0]
        
        # 获取该域的默认动作配置
        domain_actions = self.default_actions.get(domain, {})

        # 如果没有传入状态，则获取当前状态
        if current_state is None:
            state = self.hass.states.get(entity_id)
            current_state = state.state if state else "unknown"

        # 空调特殊处理
        if domain == "climate":
            return self.generate_climate_action(entity_id, action_type)

        # 窗帘特殊处理
        if domain == "cover":
            return self.generate_cover_action(entity_id, action_type)

        # 确保current_state是字符串类型
        if not isinstance(current_state, str):
            current_state = "unknown"

        if action_type == "auto":
            # 自动选择最合适的动作
            # 优先使用default_actions中的配置
            if domain in self.default_actions:
                if current_state == "on" and "turn_off" in domain_actions:
                    action_cfg = domain_actions["turn_off"]
                elif current_state == "off" and "turn_on" in domain_actions:
                    action_cfg = domain_actions["turn_on"]
                else:
                    # 默认关闭
                    action_cfg = domain_actions.get("turn_off", {"service": f"{domain}.turn_off"})
                
                return {
                    "type": "service_call",
                    "service": action_cfg["service"],
                    "data": {**action_cfg.get("data", {}), "entity_id": entity_id},
                    "description": action_cfg.get("description", "Auto action"),
                }
            
            # 默认逻辑（兼容模式）
            if domain == "light":
                return {
                    "type": "service_call",
                    "service": "light.turn_off"
                    if current_state == "on"
                    else "light.turn_on",
                    "data": {"entity_id": entity_id},
                    "description": "Turn off" if current_state == "on" else "Turn on",
                }

            elif domain == "switch":
                return {
                    "type": "service_call",
                    "service": "switch.turn_off"
                    if current_state == "on"
                    else "switch.turn_on",
                    "data": {"entity_id": entity_id},
                    "description": "Turn off" if current_state == "on" else "Turn on",
                }

            elif domain == "media_player":
                if current_state == "playing":
                    return {
                        "type": "service_call",
                        "service": "media_player.media_pause",
                        "data": {"entity_id": entity_id},
                        "description": "Pause playback",
                    }
                else:
                    return {
                        "type": "service_call",
                        "service": "media_player.turn_off",
                        "data": {"entity_id": entity_id},
                        "description": "Turn off",
                    }

            elif domain == "input_boolean":
                return {
                    "type": "service_call",
                    "service": "input_boolean.turn_off"
                    if current_state == "on"
                    else "input_boolean.turn_on",
                    "data": {"entity_id": entity_id},
                    "description": "Turn off" if current_state == "on" else "Turn on",
                }
            elif domain == "cover":
                # 窗帘自动判断
                if current_state == "open":
                    action_cfg = domain_actions.get("close", {"service": "cover.close"})
                else:
                    action_cfg = domain_actions.get("open", {"service": "cover.open"})

                return {
                    "type": "service_call",
                    "service": action_cfg["service"],
                    "data": {**action_cfg.get("data", {}), "entity_id": entity_id},
                    "description": "Close cover" if current_state == "open" else "Open cover",
                }
            else:
                # 通用关闭动作
                return {
                    "type": "service_call",
                    "service": f"{domain}.turn_off",
                    "data": {"entity_id": entity_id},
                    "description": "Turn off",
                }

        elif action_type == "toggle":
            # 优先使用default_actions中的配置
            if "toggle" in domain_actions:
                action_cfg = domain_actions["toggle"]
                return {
                    "type": "service_call",
                    "service": action_cfg["service"],
                    "data": {**action_cfg.get("data", {}), "entity_id": entity_id},
                    "description": action_cfg.get("description", "Toggle state"),
                }
            
            # 默认toggle动作
            return {
                "type": "service_call",
                "service": f"{domain}.toggle",
                "data": {"entity_id": entity_id},
                "description": "Toggle state",
            }

        elif action_type == "turn_off":
            # 优先使用default_actions中的配置
            if "turn_off" in domain_actions:
                action_cfg = domain_actions["turn_off"]
                return {
                    "type": "service_call",
                    "service": action_cfg["service"],
                    "data": {**action_cfg.get("data", {}), "entity_id": entity_id},
                    "description": action_cfg.get("description", "Turn off"),
                }
            
            # 默认turn_off动作
            return {
                "type": "service_call",
                "service": f"{domain}.turn_off",
                "data": {"entity_id": entity_id},
                "description": "Turn off",
            }

        elif action_type == "turn_on":
            # 优先使用default_actions中的配置
            if "turn_on" in domain_actions:
                action_cfg = domain_actions["turn_on"]
                return {
                    "type": "service_call",
                    "service": action_cfg["service"],
                    "data": {**action_cfg.get("data", {}), "entity_id": entity_id},
                    "description": action_cfg.get("description", "Turn on"),
                }
            
            # 默认turn_on动作
            return {
                "type": "service_call",
                "service": f"{domain}.turn_on",
                "data": {"entity_id": entity_id},
                "description": "Turn on",
            }

    def parse_duration(self, duration_str):
        """解析时长字符串."""
        try:
            if ":" in duration_str:
                # HH:MM:SS 或 MM:SS 格式
                parts = duration_str.split(":")
                if len(parts) == 2:
                    hours, minutes = 0, int(parts[0])
                    seconds = int(parts[1])
                else:
                    hours, minutes, seconds = map(int, parts)
            else:
                # 纯秒数
                seconds = int(duration_str)
                hours = seconds // 3600
                minutes = (seconds % 3600) // 60
                seconds = seconds % 60

            return timedelta(hours=hours, minutes=minutes, seconds=seconds)
        except:
            raise ValueError("Invalid time format, use HH:MM:SS or seconds")

    def get_action_description(self, action):
        """获取动作描述."""
        return action.get("description", action.get("service", "Unknown action"))

    def get_climate_action_description(self, action):
        """获取空调动作描述."""
        desc = action.get("description", "")
        if action.get("service") == "climate.set_temperature":
            temp = action.get("data", {}).get("temperature")
            if temp:
                desc = f"Set temperature to {temp}°C"
        return desc

    def get_cover_action_description(self, action):
        """获取窗帘动作描述."""
        desc = action.get("description", "")
        if action.get("service") == "cover.set_cover_position":
            position = action.get("data", {}).get("position")
            if position is not None:
                desc = f"Set cover position to {position}%"
        return desc

    async def cancel_timer(self, timer_id: str) -> None:
        """取消指定定时器."""
        if timer_id in self.tasks:
            try:
                timer = self.tasks[timer_id]
                entity_id = timer["entity_id"]

                # 检查是否为周期任务
                if timer.get("is_recurring"):
                    return await self.cancel_schedule(timer_id)

                # 无论timer_handle是否存在，都要取消
                if timer_id in self.timers:
                    timer_handle = self.timers[timer_id]
                    if timer_handle:
                        timer_handle()

                    # 清理定时器句柄
                    del self.timers[timer_id]

                # 清理预捕获定时器句柄
                pre_key = f"{timer_id}_pre"
                if pre_key in self.timers:
                    self.timers[pre_key]()
                    del self.timers[pre_key]

                # 更新状态
                timer["status"] = "cancelled"
                timer["cancelled_at"] = self.datetime_to_iso(self.get_local_now())

                # 统一设置 execution_result 字段
                # 如果之前执行过（有 executed_at），则标记为 success；否则标记为 cancelled
                if timer.get("executed_at"):
                    timer["execution_result"] = "success"
                else:
                    timer["execution_result"] = "cancelled"

                # 彻底清理所有相关引用
                if entity_id in self.entity_timers and self.entity_timers[entity_id] == timer_id:
                    del self.entity_timers[entity_id]

                # 确保没有其他活跃的定时器使用相同实体
                await self.cleanup_entity_timers(entity_id, timer_id)

                await self.save_tasks()
                await self._update_sensor()

                # 发送响应事件
                self.hass.bus.fire(
                    "timer_backend_response",
                    {
                        "action": "timer_cancelled",
                        "timer_id": timer_id,
                        "entity_id": entity_id,
                        "entity_name": timer["entity_name"],
                        "message": f"Timer cancelled for {timer['entity_name']}",
                        "time_zone": self.time_zone,
                    },
                )

                _LOGGER.info(f"Timer cancelled: {timer_id} for entity: {entity_id}")

            except Exception as e:
                _LOGGER.error(f"Failed to cancel timer: {e}")
        else:
            _LOGGER.warning(f"Timer not found for cancellation: {timer_id}")

    async def cancel_schedule(self, schedule_id: str) -> None:
        """取消周期定时任务."""
        if schedule_id in self.tasks:
            try:
                schedule = self.tasks[schedule_id]

                if not schedule.get("is_recurring"):
                    _LOGGER.debug(f"Task {schedule_id} is not a recurring schedule")
                    return

                # 取消定时器
                if schedule_id in self.recurring_timers:
                    timer_handle = self.recurring_timers[schedule_id]
                    if timer_handle:
                        timer_handle()
                    del self.recurring_timers[schedule_id]

                # 清理预捕获定时器
                pre_key = f"{schedule_id}_pre"
                if pre_key in self.recurring_timers:
                    self.recurring_timers[pre_key]()
                    del self.recurring_timers[pre_key]

                # 更新状态
                schedule["status"] = "cancelled"
                schedule["cancelled_at"] = self.datetime_to_iso(self.get_local_now())

                # 统一设置 execution_result 字段
                # 如果之前执行过（有 last_executed），则标记为 success；否则标记为 cancelled
                if schedule.get("last_executed"):
                    schedule["execution_result"] = "success"
                else:
                    schedule["execution_result"] = "cancelled"

                await self.save_tasks()
                await self._update_sensor()

                # 发送响应事件
                self.hass.bus.fire(
                    "timer_backend_response",
                    {
                        "action": "schedule_cancelled",
                        "schedule_id": schedule_id,
                        "entity_id": schedule["entity_id"],
                        "entity_name": schedule["entity_name"],
                        "message": f"Schedule cancelled for {schedule['entity_name']}",
                        "time_zone": self.time_zone,
                    },
                )

                _LOGGER.info(f"Schedule cancelled: {schedule_id}")

            except Exception as e:
                _LOGGER.error(f"Failed to cancel schedule: {e}")
        else:
            _LOGGER.warning(f"Schedule not found for cancellation: {schedule_id}")

    async def cleanup_entity_timers(self, entity_id, exclude_timer_id=None):
        """清理实体相关的所有定时器状态，排除指定的定时器ID."""
        # 检查entity_timers中是否有该实体的其他定时器引用
        if entity_id in self.entity_timers:
            referenced_timer_id = self.entity_timers[entity_id]
            if referenced_timer_id != exclude_timer_id:
                # 如果引用的不是当前取消的定时器，也需要处理
                if referenced_timer_id in self.tasks:
                    timer = self.tasks[referenced_timer_id]
                    if timer.get("status") == "active":
                        timer["status"] = "cancelled"
                        timer["cancelled_at"] = self.datetime_to_iso(
                            self.get_local_now()
                        )
                        # 统一设置 execution_result 字段
                        if timer.get("executed_at"):
                            timer["execution_result"] = "success"
                        else:
                            timer["execution_result"] = "cancelled"
                        _LOGGER.debug(
                            f"Cleaned up active timer from entity_timers: {referenced_timer_id}"
                        )

                # 清理引用
                del self.entity_timers[entity_id]

        # 检查是否还有其他使用相同实体的活跃定时器
        for timer_id, timer_data in list(self.tasks.items()):
            if (
                timer_id != exclude_timer_id
                and timer_data.get("entity_id") == entity_id
                and timer_data.get("status") == "active"
            ):

                # 取消这些定时器
                if timer_id in self.timers:
                    timer_handle = self.timers[timer_id]
                    if timer_handle:
                        timer_handle()
                    del self.timers[timer_id]

                # 更新状态
                timer_data["status"] = "cancelled"
                timer_data["cancelled_at"] = self.datetime_to_iso(self.get_local_now())
                _LOGGER.debug(f"Cleaned up other active timers for same entity: {timer_id}")

    async def cancel_entity_timer(self, entity_id: str, user_id=None) -> None:
        """取消实体相关的定时器."""
        cancelled_count = 0

        # 首先检查entity_timers中是否有该实体的定时器
        if entity_id in self.entity_timers:
            timer_id = self.entity_timers[entity_id]
            # 先删除entity_timers引用，避免重复处理
            del self.entity_timers[entity_id]
            # 只有当tasks中存在时才调用cancel_timer
            if timer_id in self.tasks:
                await self.cancel_timer(timer_id)
                cancelled_count += 1
            else:
                _LOGGER.debug(f"Timer {timer_id} not in tasks, cleaned up entity_timers reference")

        # 然后检查tasks中是否有该实体的其他活跃定时器（防止遗漏）
        for timer_id, timer_data in list(self.tasks.items()):
            if (
                timer_data.get("entity_id") == entity_id
                and timer_data.get("status") == "active"
            ):

                # 避免重复取消
                if timer_id not in self.timers:
                    # 如果timers中没有但tasks中还有活跃状态，说明可能是遗漏的定时器
                    timer_data["status"] = "cancelled"
                    timer_data["cancelled_at"] = self.datetime_to_iso(
                        self.get_local_now()
                    )
                    # 统一设置 execution_result 字段
                    if timer_data.get("executed_at"):
                        timer_data["execution_result"] = "success"
                    else:
                        timer_data["execution_result"] = "cancelled"
                    _LOGGER.debug(f"Cleaned up missed active timer: {timer_id}")
                    cancelled_count += 1

        if cancelled_count > 0:
            await self.save_tasks()
            await self._update_sensor()
            _LOGGER.info(f"Cancelled {cancelled_count} timer(s) for entity: {entity_id}")
        else:
            _LOGGER.debug(f"No active timers found for entity: {entity_id}")

    async def send_all_timers(self, user_id=None) -> None:
        """发送所有定时器状态."""
        try:
            # 计算每个定时器的剩余时间
            active_timers = []
            active_schedules = []
            now = self.get_local_now()

            for timer_id, timer in self.tasks.items():
                if timer.get("is_recurring"):
                    # 周期任务
                    if timer["status"] == "active":
                        schedule_info = {
                            "schedule_id": timer_id,
                            "entity_id": timer["entity_id"],
                            "entity_name": timer["entity_name"],
                            "repeat_type": timer["repeat_type"],
                            "schedule_time": timer["schedule_time"],
                            "status": timer["status"],
                            "last_executed": timer.get("last_executed"),
                            "next_execution": timer.get("next_execution"),
                            "is_climate": timer.get("is_climate", False),
                            "is_cover": timer.get("is_cover", False),
                            "action_type": timer.get("action_type", "auto"),
                            "time_zone": timer.get("time_zone", self.time_zone),
                        }

                        # 添加特定类型信息
                        if timer["repeat_type"] == "weekly":
                            schedule_info["weekdays"] = timer.get("weekdays", [])
                        elif timer["repeat_type"] == "monthly":
                            schedule_info["month_days"] = timer.get("month_days", [])

                        # 如果指定了用户，只返回该用户的定时器（api_user创建的任务对所有人可见）
                        if user_id and timer.get("created_by") not in [user_id, "api_user", None]:
                            continue

                        active_schedules.append(schedule_info)

                elif timer["status"] == "active":
                    # 一次性定时器
                    end_time = self.iso_to_datetime(timer["end_time"])
                    remaining = max(0, (end_time - now).total_seconds())

                    # 如果定时器已经过期，标记为完成
                    if remaining <= 0:
                        timer["status"] = "completed"
                        timer["executed_at"] = self.datetime_to_iso(now)
                        # 由于没有实际执行记录，标记为 unknown
                        if not timer.get("execution_result"):
                            timer["execution_result"] = "unknown"
                        # 清理定时器
                        entity_id = timer["entity_id"]
                        if entity_id in self.entity_timers:
                            del self.entity_timers[entity_id]
                        if timer_id in self.timers:
                            del self.timers[timer_id]
                        continue

                    timer_info = {
                        "timer_id": timer_id,
                        "entity_id": timer["entity_id"],
                        "entity_name": timer["entity_name"],
                        "duration": timer["duration"],
                        "end_time": timer["end_time"],
                        "remaining_seconds": remaining,
                        "action": self.get_action_description(timer["action"]),
                        "is_climate": timer.get("is_climate", False),
                        "is_cover": timer.get("is_cover", False),
                        "time_zone": self.time_zone,
                    }

                    # 如果是空调，添加额外信息
                    if timer.get("is_climate"):
                        timer_info["previous_mode"] = (
                            timer.get("previous_state", {}).get("hvac_mode", "Unknown")
                        )
                        timer_info["target_action"] = (
                            timer.get("action", {}).get("description", "Climate control")
                        )

                    # 如果是窗帘，添加额外信息
                    if timer.get("is_cover"):
                        timer_info["previous_position"] = (
                            timer.get("previous_state", {}).get("current_position", 0)
                        )
                        timer_info["target_action"] = (
                            timer.get("action", {}).get("description", "Cover control")
                        )

                    # 如果指定了用户，只返回该用户的定时器（api_user创建的任务对所有人可见）
                    if user_id and timer.get("created_by") not in [user_id, "api_user", None]:
                        continue

                    active_timers.append(timer_info)

            # 发送事件 - 确保事件名称正确
            event_data = {
                "action": "timers_list",
                "timers": active_timers,
                "schedules": active_schedules,
                "timer_count": len(active_timers),
                "schedule_count": len(active_schedules),
                "source": "timer_backend",
                "timestamp": self.datetime_to_iso(now),
                "time_zone": self.time_zone,
            }

            self.hass.bus.fire("timer_backend_response", event_data)

            # 保存可能的更改（如定时器过期），但限制保存频率
            need_save = any(timer.get("status") == "completed" for timer in self.tasks.values())

            if need_save:
                # 如果距离上次保存超过10秒，或者没有上次保存时间，才保存
                current_time = self.get_local_now()
                last_save_time = getattr(self, "_last_tasks_save_time", None)

                if last_save_time is None or (current_time - last_save_time).total_seconds() > 10:
                    await self.save_tasks()
                    self._last_tasks_save_time = current_time

        except Exception as e:
            _LOGGER.error(f"Failed to send timers list: {e}")

    async def send_all_schedules(self, user_id=None) -> None:
        """发送所有周期任务状态."""
        try:
            active_schedules = []

            for timer_id, timer in self.tasks.items():
                if timer.get("is_recurring") and timer["status"] == "active":
                    schedule_info = {
                        "schedule_id": timer_id,
                        "entity_id": timer["entity_id"],
                        "entity_name": timer["entity_name"],
                        "repeat_type": timer["repeat_type"],
                        "schedule_time": timer["schedule_time"],
                        "status": timer["status"],
                        "last_executed": timer.get("last_executed"),
                        "next_execution": timer.get("next_execution"),
                        "is_climate": timer.get("is_climate", False),
                        "is_cover": timer.get("is_cover", False),
                        "action_type": timer.get("action_type", "auto"),
                        "time_zone": timer.get("time_zone", self.time_zone),
                    }

                    # 添加特定类型信息
                    if timer["repeat_type"] == "weekly":
                        schedule_info["weekdays"] = timer.get("weekdays", [])
                    elif timer["repeat_type"] == "monthly":
                        schedule_info["month_days"] = timer.get("month_days", [])

                    # 如果指定了用户，只返回该用户的定时器（api_user创建的任务对所有人可见）
                    if user_id and timer.get("created_by") not in [user_id, "api_user", None]:
                        continue

                    active_schedules.append(schedule_info)

            # 发送事件
            event_data = {
                "action": "schedules_list",
                "schedules": active_schedules,
                "count": len(active_schedules),
                "source": "timer_backend",
                "timestamp": self.datetime_to_iso(self.get_local_now()),
                "time_zone": self.time_zone,
            }

            self.hass.bus.fire("timer_backend_response", event_data)

        except Exception as e:
            _LOGGER.error(f"Failed to send schedules list: {e}")

    def get_friendly_name(self, entity_id: str) -> str:
        """获取实体友好名称."""
        state = self.hass.states.get(entity_id)
        if state and state.attributes.get("friendly_name"):
            return state.attributes["friendly_name"]
        return entity_id

    def _pre_capture_state(self, now, timer_id: str, *args, **kwargs) -> None:
        """在定时器到期前10秒预捕获实体状态."""
        if timer_id in self.tasks:
            asyncio.run_coroutine_threadsafe(
                self._async_pre_capture_state(timer_id), self.hass.loop
            )

    async def _async_pre_capture_state(self, timer_id: str) -> None:
        """异步预捕获实体状态."""
        if timer_id in self.tasks:
            timer = self.tasks[timer_id]
            entity_id = timer["entity_id"]
            before_state = self.hass.states.get(entity_id)
            timer["before_entity_state"] = before_state.state if before_state else "unknown"
            # 保存预捕获的状态到任务数据
            await self.save_tasks()

    def execute_timer(self, now, timer_id: str, *args, **kwargs) -> None:
        """执行通用定时器 - 同步方法，内部使用线程安全的方式调用异步服务."""
        if timer_id in self.tasks:
            # 在事件循环中创建任务
            asyncio.run_coroutine_threadsafe(
                self._async_execute_timer(timer_id), self.hass.loop
            )

    async def _async_execute_timer(self, timer_id: str) -> None:
        """异步执行通用定时器."""
        if timer_id not in self.tasks:
            return

        timer = self.tasks[timer_id]
        entity_id = timer["entity_id"]

        # 检查定时器是否已被取消
        if timer.get("status") == "cancelled":
            _LOGGER.debug(f"Timer {timer_id} was cancelled, skipping execution")
            return

        # 使用预捕获的 before_entity_state（在定时器到期前10秒已捕获）
        # 如果没有预捕获，则在执行时获取
        before_entity_state = timer.get("before_entity_state", "unknown")
        if before_entity_state == "unknown":
            before_state = self.hass.states.get(entity_id)
            before_entity_state = before_state.state if before_state else "unknown"

        try:
            action = timer["action"]
            success = False

            if action["type"] == "service_call":
                domain, service = action["service"].split(".")
                await self.hass.services.async_call(
                    domain, service, action.get("data", {})
                )
                success = True

            # 执行成功后等待2秒再获取 after_entity_state
            if success:
                await asyncio.sleep(2)

            # 获取执行后的实体状态
            after_state = self.hass.states.get(entity_id)
            after_entity_state = after_state.state if after_state else "unknown"

            # 更新状态
            if success:
                timer["status"] = "completed"
                timer["executed_at"] = self.datetime_to_iso(self.get_local_now())
                timer["execution_result"] = "success"
            else:
                timer["status"] = "failed"
                timer["execution_result"] = "failed"

            # 记录历史
            await self.add_history_record(
                timer_id=timer_id,
                entity_id=entity_id,
                entity_name=timer.get("entity_name", entity_id),
                task_action=action.get("description", action.get("service", "unknown")),
                before_entity_state=before_entity_state,
                after_entity_state=after_entity_state,
                execution_result="success" if success else "failed",
                start_time=timer.get("start_time", ""),
                end_time=timer.get("end_time", ""),
                creation_time=timer.get("created_at", ""),
            )

            # 更新统计
            await self.update_stats()

            # 清理
            if entity_id in self.entity_timers:
                del self.entity_timers[entity_id]
            if timer_id in self.timers:
                del self.timers[timer_id]

            await self.save_tasks()
            await self._update_sensor()

            # 发送通知
            self.hass.bus.fire(
                "timer_backend_response",
                {
                    "action": "timer_completed",
                    "timer_id": timer_id,
                    "entity_id": entity_id,
                    "entity_name": timer["entity_name"],
                    "success": success,
                    "before_entity_state": before_entity_state,
                    "after_entity_state": after_entity_state,
                    "message": f"Timer executed for {timer['entity_name']}",
                    "time_zone": self.time_zone,
                },
            )

            # 记录执行结果
            if success:
                _LOGGER.info(
                    f"Timer executed successfully: {entity_id} - {timer['action'].get('description', '')}"
                )
            else:
                _LOGGER.error(f"Timer execution failed: {entity_id}")

        except Exception as e:
            _LOGGER.error(f"Failed to execute timer: {e}")
            timer["status"] = "error"
            timer["error"] = str(e)
            timer["execution_result"] = "failed"

            # 获取执行后的实体状态（失败时也要记录）
            after_state = self.hass.states.get(entity_id)
            after_entity_state = after_state.state if after_state else "unknown"

            # 记录失败历史
            await self.add_history_record(
                timer_id=timer_id,
                entity_id=entity_id,
                entity_name=timer.get("entity_name", entity_id),
                task_action=timer.get("action", {}).get("description", "unknown"),
                before_entity_state=before_entity_state,
                after_entity_state=after_entity_state,
                execution_result="failed",
                start_time=timer.get("start_time", ""),
                end_time=timer.get("end_time", ""),
                creation_time=timer.get("created_at", ""),
            )

            # 更新统计
            await self.update_stats()

            await self.save_tasks()
            await self._update_sensor()

    async def _update_sensor(self) -> None:
        """Update sensor state."""
        # Count active tasks
        active_timers = sum(
            1
            for timer in self.tasks.values()
            if not timer.get("is_recurring") and timer.get("status") == "active"
        )
        active_schedules = sum(
            1
            for timer in self.tasks.values()
            if timer.get("is_recurring") and timer.get("status") == "active"
        )

        # 获取所有任务列表
        all_task_list = self.stats.get("all_task_list", [])

        # Send update signal
        async_dispatcher_send(
            self.hass,
            SIGNAL_UPDATE_SENSOR,
            {
                "active_tasks": active_timers + active_schedules,
                "active_timers": active_timers,
                "active_schedules": active_schedules,
                "total_tasks": len(all_task_list),  # 使用 all_task_list 的长度
                "current_task": active_timers + active_schedules,
                "successful_task": self.stats["successful_task"],
                "failed_task": self.stats["failed_task"],
                "today_task": self.stats["today_task"],
                "all_task_list": all_task_list,
            },
        )

    async def add_history_record(
        self,
        timer_id: str,
        entity_id: str,
        entity_name: str,
        task_action: str,
        before_entity_state: str,
        after_entity_state: str,
        execution_result: str,
        start_time: str,
        end_time: str,
        creation_time: str,
    ) -> None:
        """将执行结果合并到任务数据中."""
        try:
            now = self.get_local_now()

            # 将历史信息直接合并到 self.tasks 中的任务
            if timer_id in self.tasks:
                task = self.tasks[timer_id]
                task["day"] = now.strftime("%Y-%m-%d")
                task["before_entity_state"] = before_entity_state
                task["after_entity_state"] = after_entity_state
                task["execution_result"] = execution_result
                task["task_action"] = task_action
                # 确保执行时间已设置
                if not task.get("executed_at"):
                    task["executed_at"] = end_time
            else:
                # 任务不在 self.tasks 中（异常情况），创建一个记录
                self.tasks[timer_id] = {
                    "id": timer_id,
                    "entity_id": entity_id,
                    "entity_name": entity_name,
                    "status": "completed" if execution_result == "success" else "failed",
                    "task_type": "定时任务",
                    "day": now.strftime("%Y-%m-%d"),
                    "creation_time": creation_time,
                    "start_time": start_time,
                    "end_time": end_time,
                    "before_entity_state": before_entity_state,
                    "after_entity_state": after_entity_state,
                    "execution_result": execution_result,
                    "task_action": task_action,
                    "is_recurring": False,
                    "repeat_type": "none",
                }

            # 限制非活跃任务数量（保留最近 MAX_HISTORY_RECORDS 条非活跃任务）
            non_active = [
                (tid, td) for tid, td in self.tasks.items()
                if td.get("status") != "active"
            ]
            if len(non_active) > MAX_HISTORY_RECORDS:
                # 按创建时间倒序，删除最旧的非活跃任务
                non_active.sort(
                    key=lambda x: x[1].get("created_at") or x[1].get("creation_time") or "",
                    reverse=True,
                )
                for tid, _ in non_active[MAX_HISTORY_RECORDS:]:
                    del self.tasks[tid]

            # 保存
            await self.save_tasks()

            _LOGGER.debug(f"Updated history for timer {timer_id}")
        except Exception as e:
            _LOGGER.error(f"Failed to add history record: {e}")

    async def update_stats(self) -> None:
        """更新统计数据（全部从 self.tasks 统计）."""
        try:
            now = self.get_local_now()
            today_str = now.strftime("%Y-%m-%d")

            # 统计总任务数
            self.stats["total_task"] = len(self.tasks)

            # 从 self.tasks 统计成功、失败、今日任务数
            self.stats["successful_task"] = sum(
                1 for td in self.tasks.values() if td.get("execution_result") == "success"
            )
            self.stats["failed_task"] = sum(
                1 for td in self.tasks.values() if td.get("execution_result") == "failed"
            )
            self.stats["today_task"] = sum(
                1 for td in self.tasks.values() if td.get("day") == today_str
            )

            # 统计活跃任务数
            self.stats["active_timers"] = sum(
                1 for td in self.tasks.values()
                if td.get("status") == "active" and not td.get("is_recurring")
            )
            self.stats["active_schedules"] = sum(
                1 for td in self.tasks.values()
                if td.get("status") == "active" and td.get("is_recurring")
            )

            # 构建所有任务列表（直接从 self.tasks，不跳过活跃任务）
            all_task_list = []
            for task_id, task_data in self.tasks.items():
                # 获取任务动作描述
                if task_data.get("is_recurring"):
                    task_action = self._get_task_action_description(task_data)
                else:
                    action = task_data.get("action", {})
                    task_action = action.get("description", action.get("service", task_data.get("task_action", "未知动作")))

                # 以 task_data 为基础，保留 JSON 中的所有字段
                task_info = dict(task_data)
                # 覆盖/添加计算字段
                task_info["id"] = task_id
                task_info["task_type"] = "周期任务" if task_data.get("is_recurring") else "定时任务"
                task_info["task_action"] = task_action

                # 转换时间字段为本地时区
                for time_key in ("created_at", "executed_at", "cancelled_at", "start_time", "end_time", "next_execution", "last_executed"):
                    if task_info.get(time_key):
                        task_info[time_key] = self.convert_to_local_time_str(task_info[time_key])

                # 统一设置 execution_result（如果任务自身没有，根据状态推断）
                if not task_data.get("execution_result"):
                    status = task_data.get("status", "unknown")
                    if status == "completed":
                        task_info["execution_result"] = "success"
                    elif status in ("failed", "error"):
                        task_info["execution_result"] = "failed"
                    elif status == "cancelled":
                        task_info["execution_result"] = "cancelled" if not task_data.get("executed_at") else "success"
                    elif status == "expired":
                        task_info["execution_result"] = "unknown"
                    elif status == "active":
                        task_info["execution_result"] = ""
                    else:
                        task_info["execution_result"] = "unknown"
                # 如果 execution_result 存在但值为空或无效，也要根据状态修正
                elif task_data.get("execution_result") in ("", None, "unknown"):
                    status = task_data.get("status", "unknown")
                    if status == "completed":
                        task_info["execution_result"] = "success"
                    elif status in ("failed", "error"):
                        task_info["execution_result"] = "failed"
                    elif status == "cancelled":
                        task_info["execution_result"] = "cancelled" if not task_data.get("executed_at") else "success"

                # 确保 after_entity_state 字段存在
                if "after_entity_state" not in task_info and task_data.get("status") in ("completed", "failed", "error"):
                    # 尝试从内存中获取
                    if "after_entity_state" in task_data:
                        task_info["after_entity_state"] = task_data["after_entity_state"]
                    else:
                        task_info["after_entity_state"] = "unknown"

                # 补充 day 字段（如果没有的话，从时间字段提取）
                if not task_info.get("day"):
                    created = task_data.get("created_at") or task_data.get("creation_time") or ""
                    if created:
                        task_info["day"] = created.split("T")[0] if "T" in created else created.split(" ")[0]

                all_task_list.append(task_info)

            # 保存到 stats
            self.stats["all_task_list"] = all_task_list

            _LOGGER.debug(f"Stats updated: {self.stats}")
        except Exception as e:
            _LOGGER.error(f"Failed to update stats: {e}")

    def _get_task_action_description(self, task_data: dict) -> str:
        """获取任务动作描述."""
        try:
            entity_id = task_data.get("entity_id", "")
            action_type = task_data.get("action_type", "auto")
            domain = entity_id.split(".")[0] if "." in entity_id else ""

            # 如果有 action_data，从中获取更多信息
            action_data = task_data.get("action_data", {})

            # 根据动作类型生成描述
            if action_type == "turn_on":
                return "打开"
            elif action_type == "turn_off":
                return "关闭"
            elif action_type == "toggle":
                return "切换"
            elif action_type == "auto":
                # 自动模式，根据实体状态决定
                entity_state = task_data.get("entity_state", "")
                if entity_state == "on":
                    return "关闭"
                elif entity_state == "off":
                    return "打开"
                else:
                    return "自动操作"
            elif action_type == "set_temperature":
                temp = action_data.get("temperature", "")
                return f"设置温度{temp}°C" if temp else "设置温度"
            elif action_type == "set_mode":
                mode = action_data.get("mode", "")
                return f"设置模式为{mode}" if mode else "设置模式"
            else:
                return action_type

        except Exception as e:
            _LOGGER.error(f"Failed to get task action description: {e}")
            return "未知动作"
