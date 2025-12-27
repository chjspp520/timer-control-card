import appdaemon.plugins.hass.hassapi as hass
import json
import os
import uuid
from datetime import datetime, timedelta
import asyncio
import pytz
from enum import Enum
from typing import Dict, List, Optional, Any
import calendar

class RepeatType(Enum):
    """重复类型枚举"""
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"

class TimerBackend(hass.Hass):
    """定时任务后端 - 包含空调支持的全自动版本，支持周期定时"""
    
    def initialize(self):
        """初始化应用"""
        # 配置文件 - 使用指定的路径
        self.persist_file = "/homeassistant/www/logstimer_tasks.json"
        self.event_name = self.args.get("event_name", "timer_backend_event")
        self.default_actions = self.args.get("default_actions", {})
        
        # 获取AppDaemon时区配置
        self.time_zone = self.args.get("time_zone", "Asia/Shanghai")
        try:
            self.tz = pytz.timezone(self.time_zone)
        except:
            self.log(f"Invalid time zone: {self.time_zone}, using UTC", level="WARNING")
            self.tz = pytz.UTC
        
        # 空调相关配置
        self.climate_config = {
            "default_temperature": 25.0,
            "default_mode": "cool",
            "restore_previous": True,  # 是否恢复之前的设置
            "save_state_on_timer": True,  # 定时时保存当前状态
        }
        
        # 存储
        self.tasks = {}
        self.timers = {}
        self.recurring_timers = {}  # 周期定时器句柄
        self.entity_timers = {}  # 按实体ID索引的定时器
        self.climate_previous_states = {}  # 保存空调之前的状态
        
        # 监听事件
        self.listen_event(self.handle_frontend_event, self.event_name)
        
        # 监听实体状态变化（用于保存空调状态）
        self.listen_state(self.handle_climate_state_change, "climate")
        
        # 恢复任务
        self.run_in(self.restore_tasks, 2)
        
        # 设置每日午夜检查周期任务（使用本地时区）
        self.run_daily(self.check_recurring_schedules, "00:00:00")
        
        self.log(f"Timer backend started - with climate and recurring schedule support (Timezone: {self.time_zone})")
    
    def get_local_now(self) -> datetime:
        """获取本地时区的当前时间"""
        utc_now = datetime.now(pytz.UTC)
        return utc_now.astimezone(self.tz)
    
    def parse_local_time(self, time_str: str, date_obj: datetime = None) -> datetime:
        """解析本地时间字符串为datetime对象"""
        if not date_obj:
            date_obj = self.get_local_now()
        
        # 解析时间字符串
        hour, minute, second = map(int, time_str.split(":"))
        
        # 创建本地时间的naive datetime
        local_naive = datetime(
            date_obj.year,
            date_obj.month,
            date_obj.day,
            hour,
            minute,
            second,
            0  # 微秒
        )
        
        # 转换为时区感知的datetime
        return self.tz.localize(local_naive)
    
    def datetime_to_iso(self, dt: datetime) -> str:
        """将datetime转换为ISO格式字符串（返回UTC时间，带Z后缀）"""
        if dt.tzinfo is None:
            # 如果没有时区信息，假设为本地时区
            dt = self.tz.localize(dt)
        # 转换为UTC并返回带Z后缀的ISO格式
        utc_dt = dt.astimezone(pytz.UTC)
        return utc_dt.strftime('%Y-%m-%dT%H:%M:%SZ')
    
    def iso_to_datetime(self, iso_str: str) -> datetime:
        """将ISO字符串转换为本地时区datetime"""
        try:
            # 如果字符串以Z结尾，替换为+00:00以便fromisoformat解析
            if iso_str.endswith('Z'):
                iso_str = iso_str.replace('Z', '+00:00')
            dt = datetime.fromisoformat(iso_str)
            if dt.tzinfo is None:
                # 如果没有时区信息，假设为本地时区
                dt = self.tz.localize(dt)
            return dt
        except:
            # 如果解析失败，尝试其他格式
            try:
                dt = datetime.strptime(iso_str, "%Y-%m-%d %H:%M:%S")
                return self.tz.localize(dt)
            except:
                self.log(f"Failed to parse datetime: {iso_str}", level="WARNING")
                return self.get_local_now()
    
    def ensure_file_exists(self):
        """确保文件存在，如果不存在则创建"""
        try:
            # 确保目录存在
            directory = os.path.dirname(self.persist_file)
            if directory and not os.path.exists(directory):
                os.makedirs(directory, exist_ok=True)
                self.log(f"Created directory: {directory}")
            
            # 如果文件不存在，创建空文件
            if not os.path.exists(self.persist_file):
                with open(self.persist_file, 'w') as f:
                    json.dump({}, f, indent=2)
                self.log(f"Created empty task file: {self.persist_file}")
                return True
            return False
        except Exception as e:
            self.log(f"Failed to ensure file exists: {e}", level="ERROR")
            return False
    
    def save_tasks(self):
        """保存任务到文件"""
        try:
            # 确保文件存在
            self.ensure_file_exists()
            
            # 保存文件
            with open(self.persist_file, 'w') as f:
                json.dump(self.tasks, f, indent=2, default=str)
                
            self.log(f"Tasks saved to {self.persist_file}")
            
        except Exception as e:
            self.log(f"Failed to save tasks: {e}", level="ERROR")
            # 尝试创建文件后重试
            try:
                self.ensure_file_exists()
                with open(self.persist_file, 'w') as f:
                    json.dump(self.tasks, f, indent=2, default=str)
                self.log(f"Tasks saved after file creation: {self.persist_file}")
            except Exception as retry_error:
                self.log(f"Failed to save after retry: {retry_error}", level="ERROR")
    
    def restore_tasks(self, kwargs):
        """恢复保存的任务"""
        try:
            # 确保文件存在
            self.ensure_file_exists()
            
            if os.path.exists(self.persist_file):
                with open(self.persist_file, 'r') as f:
                    data = json.load(f)
                
                restored = 0
                recurring_restored = 0
                for timer_id, timer_data in data.items():
                    # 检查是否为周期任务
                    repeat_type = timer_data.get("repeat_type", "none")
                    schedule_time = timer_data.get("schedule_time")
                    
                    if repeat_type != "none" and schedule_time:
                        # 恢复周期任务
                        self.restore_recurring_timer(timer_id, timer_data)
                        recurring_restored += 1
                    elif timer_data.get("status") == "active":
                        # 恢复一次性定时器
                        entity_id = timer_data["entity_id"]
                        
                        # 检查是否过期（使用本地时区）
                        end_time = self.iso_to_datetime(timer_data["end_time"])
                        now = self.get_local_now()
                        
                        if end_time > now:
                            remaining = (end_time - now).total_seconds()
                            
                            # 选择正确的执行函数
                            if timer_data.get("is_climate"):
                                execute_func = self.execute_climate_timer
                            else:
                                execute_func = self.execute_timer
                            
                            # 重新安排定时器
                            timer_handle = self.run_in(
                                execute_func,
                                remaining,
                                timer_id=timer_id
                            )
                            
                            self.timers[timer_id] = timer_handle
                            self.entity_timers[entity_id] = timer_id
                            self.tasks[timer_id] = timer_data
                            restored += 1
                        else:
                            # 标记为过期
                            timer_data["status"] = "expired"
                
                self.save_tasks()
                self.log(f"Restored {restored} timers and {recurring_restored} recurring schedules")
                
            else:
                self.log("No task file found, starting with empty tasks")
                self.tasks = {}
                
        except json.JSONDecodeError:
            self.log("Task file is empty or corrupted, starting fresh")
            self.tasks = {}
            self.save_tasks()
        except Exception as e:
            self.log(f"Failed to restore tasks: {e}", level="ERROR")
            self.tasks = {}
    
    def restore_recurring_timer(self, timer_id: str, timer_data: dict):
        """恢复周期定时器"""
        try:
            repeat_type = timer_data.get("repeat_type")
            schedule_time = timer_data.get("schedule_time")
            
            if not repeat_type or not schedule_time:
                return
            
            # 保存任务数据
            self.tasks[timer_id] = timer_data
            
            # 重新安排周期任务
            self.schedule_recurring_timer(timer_id, timer_data)
            
            self.log(f"Restored recurring timer: {timer_id} - {repeat_type} at {schedule_time}")
            
        except Exception as e:
            self.log(f"Failed to restore recurring timer: {e}", level="ERROR")
    
    def handle_climate_state_change(self, entity, attribute, old, new, kwargs):
        """监听空调状态变化，保存之前的设置"""
        if entity.startswith("climate.") and attribute == "state":
            if entity not in self.climate_previous_states:
                # 保存当前完整状态
                current_state = self.get_state(entity, attribute="all")
                if current_state:
                    self.climate_previous_states[entity] = {
                        "hvac_mode": current_state.get("attributes", {}).get("hvac_mode"),
                        "temperature": current_state.get("attributes", {}).get("temperature"),
                        "fan_mode": current_state.get("attributes", {}).get("fan_mode"),
                        "swing_mode": current_state.get("attributes", {}).get("swing_mode"),
                        "preset_mode": current_state.get("attributes", {}).get("preset_mode"),
                        "saved_at": self.get_local_now().isoformat()
                    }
    
    def handle_frontend_event(self, event_name, data, kwargs):
        """处理前端事件"""
        action = data.get("action")
        
        if action == "create_timer":
            self.create_timer(data)
        elif action == "get_all_timers":
            self.send_all_timers(data.get("user_id"))
        elif action == "cancel_timer":
            self.cancel_timer(data.get("timer_id"))
        elif action == "cancel_entity_timer":
            self.cancel_entity_timer(data.get("entity_id"), data.get("user_id"))
        elif action == "create_climate_timer":
            self.create_climate_timer(data)
        elif action == "create_schedule":
            self.create_schedule(data)
        elif action == "cancel_schedule":
            self.cancel_schedule(data.get("schedule_id"))
        elif action == "get_all_schedules":
            self.send_all_schedules(data.get("user_id"))
    
    def create_timer(self, data):
        """创建通用定时器"""
        try:
            entity_id = data.get("entity_id")
            duration_str = data.get("duration", "00:30:00")
            
            if not entity_id:
                raise ValueError("Entity ID is required")
            
            # 检查实体是否存在
            state = self.get_state(entity_id)
            if state is None:
                raise ValueError(f"Entity {entity_id} does not exist")
            
            # 特殊处理空调
            if entity_id.startswith("climate."):
                return self.create_climate_timer(data)
            
            # 解析时长
            duration = self.parse_duration(duration_str)
            
            # 如果实体已有定时器，先取消
            if entity_id in self.entity_timers:
                self.cancel_entity_timer(entity_id, data.get("user_id"))
            
            # 生成ID
            timer_id = str(uuid.uuid4())
            
            # 计算时间（使用本地时区）
            start_time = self.get_local_now()
            end_time = start_time + duration
            
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
                "is_recurring": False
            }
            
            # 设置定时器
            timer_handle = self.run_in(
                self.execute_timer, 
                duration.total_seconds(), 
                timer_id=timer_id
            )
            
            # 保存
            self.timers[timer_id] = timer_handle
            self.entity_timers[entity_id] = timer_id
            self.tasks[timer_id] = timer_data
            self.save_tasks()
            
            # 发送响应
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
                "time_zone": self.time_zone
            }
            
            self.fire_event("timer_backend_response", **response_data)
            
            self.log(f"Timer created: {entity_id} - {duration_str}")
            
        except Exception as e:
            self.log(f"Failed to create timer: {e}", level="ERROR")
            self.fire_event(
                "timer_backend_response",
                action="error",
                error=str(e),
                success=False
            )
    
    def create_climate_timer(self, data):
        """创建空调专用定时器"""
        try:
            entity_id = data.get("entity_id")
            duration_str = data.get("duration", "01:00:00")  # 空调默认1小时
            action_type = data.get("action_type", "turn_off")
            
            if not entity_id:
                raise ValueError("Climate entity ID is required")
            
            # 检查是否为空调实体
            if not entity_id.startswith("climate."):
                raise ValueError("Climate entity required")
            
            state = self.get_state(entity_id)
            if state is None:
                raise ValueError(f"Climate entity {entity_id} does not exist")
            
            # 检查是否为周期任务
            repeat_type = data.get("repeat_type", "none")
            schedule_time = data.get("schedule_time")
            
            if repeat_type != "none" and schedule_time:
                # 创建周期定时任务
                return self.create_schedule(data)
            
            # 解析时长
            duration = self.parse_duration(duration_str)
            
            # 如果实体已有定时器，先取消
            if entity_id in self.entity_timers:
                self.cancel_entity_timer(entity_id, data.get("user_id"))
            
            # 生成ID
            timer_id = str(uuid.uuid4())
            
            # 计算时间（使用本地时区）
            start_time = self.get_local_now()
            end_time = start_time + duration
            
            # 获取当前空调状态
            current_state = self.get_state(entity_id, attribute="all")
            current_attrs = current_state.get("attributes", {}) if current_state else {}
            
            # 保存当前状态（用于恢复）
            if self.climate_config["save_state_on_timer"]:
                self.climate_previous_states[entity_id] = {
                    "hvac_mode": current_attrs.get("hvac_mode", "off"),
                    "temperature": current_attrs.get("temperature"),
                    "fan_mode": current_attrs.get("fan_mode"),
                    "swing_mode": current_attrs.get("swing_mode"),
                    "preset_mode": current_attrs.get("preset_mode"),
                    "current_temperature": current_attrs.get("current_temperature"),
                    "saved_at": self.datetime_to_iso(self.get_local_now())
                }
            
            # 生成空调动作
            action = self.generate_climate_action(
                entity_id, 
                action_type, 
                data.get("action_data", {})
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
                "entity_state": state,
                "domain": "climate",
                "created_by": data.get("user_id", "unknown"),
                "created_at": self.datetime_to_iso(self.get_local_now()),
                "action": action,
                "previous_state": self.climate_previous_states.get(entity_id, {}),
                "is_climate": True,
                "repeat_type": "none",
                "is_recurring": False
            }
            
            # 设置定时器
            timer_handle = self.run_in(
                self.execute_climate_timer, 
                duration.total_seconds(), 
                timer_id=timer_id
            )
            
            # 保存
            self.timers[timer_id] = timer_handle
            self.entity_timers[entity_id] = timer_id
            self.tasks[timer_id] = timer_data
            self.save_tasks()
            
            # 发送响应
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
                "time_zone": self.time_zone
            }
            
            self.fire_event("timer_backend_response", **response_data)
            
            self.log(f"Created climate timer: {entity_id} - {duration_str} - Action: {action_type}")
            
        except Exception as e:
            self.log(f"Failed to create climate timer: {e}", level="ERROR")
            self.fire_event(
                "timer_backend_response",
                action="error",
                error=str(e),
                success=False
            )
    
    def create_schedule(self, data: dict):
        """创建周期定时任务"""
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
            state = self.get_state(entity_id)
            if state is None:
                raise ValueError(f"Entity {entity_id} does not exist")
            
            # 生成ID
            schedule_id = str(uuid.uuid4())
            
            # 解析时间
            time_parts = schedule_time.split(":")
            if len(time_parts) != 3:
                raise ValueError("Schedule time must be in HH:MM:SS format")
            
            hour, minute, second = map(int, time_parts)
            
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
                "time_zone": self.time_zone
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
                current_state = self.get_state(entity_id, attribute="all")
                current_attrs = current_state.get("attributes", {}) if current_state else {}
                
                if self.climate_config["save_state_on_timer"]:
                    schedule_data["previous_state"] = {
                        "hvac_mode": current_attrs.get("hvac_mode", "off"),
                        "temperature": current_attrs.get("temperature"),
                        "fan_mode": current_attrs.get("fan_mode"),
                        "swing_mode": current_attrs.get("swing_mode"),
                        "preset_mode": current_attrs.get("preset_mode"),
                        "saved_at": self.datetime_to_iso(self.get_local_now())
                    }
                schedule_data["is_climate"] = True
            else:
                schedule_data["is_climate"] = False
            
            # 安排定时任务
            self.schedule_recurring_timer(schedule_id, schedule_data)
            
            # 保存
            self.tasks[schedule_id] = schedule_data
            self.save_tasks()
            
            # 发送响应
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
                "time_zone": self.time_zone
            }
            
            if repeat_type == "weekly":
                response_data["weekdays"] = schedule_data.get("weekdays", [])
            elif repeat_type == "monthly":
                response_data["month_days"] = schedule_data.get("month_days", [])
            
            self.fire_event("timer_backend_response", **response_data)
            
            self.log(f"Schedule created: {entity_id} - {repeat_type} at {schedule_time}")
            
        except Exception as e:
            self.log(f"Failed to create schedule: {e}", level="ERROR")
            self.fire_event(
                "timer_backend_response",
                action="error",
                error=str(e),
                success=False
            )
    
    def schedule_recurring_timer(self, schedule_id: str, schedule_data: dict):
        """安排周期定时任务（使用本地时区）"""
        try:
            repeat_type = schedule_data["repeat_type"]
            schedule_time = schedule_data["schedule_time"]
            
            # 计算下次执行时间（本地时区）
            next_execution = self.calculate_next_execution(repeat_type, schedule_time, schedule_data)
            
            if not next_execution:
                raise ValueError("无法计算下次执行时间")
            
            now = self.get_local_now()
            delay_seconds = (next_execution - now).total_seconds()
            
            if delay_seconds < 0:
                # 如果时间已过，重新计算
                self.check_recurring_schedules({})
                return
            
            # 取消已存在的定时器
            if schedule_id in self.recurring_timers:
                old_handle = self.recurring_timers[schedule_id]
                try:
                    self.cancel_timer_handle(old_handle)
                except:
                    pass
            
            # 创建新定时器
            timer_handle = self.run_in(
                self.execute_recurring_schedule,
                delay_seconds,
                schedule_id=schedule_id
            )
            
            # 保存定时器句柄和下次执行时间
            next_execution_iso = self.datetime_to_iso(next_execution)
            schedule_data["next_execution"] = next_execution_iso
            
            self.log(f"Scheduled {repeat_type} task for {schedule_data['entity_id']} at {next_execution.strftime('%Y-%m-%d %H:%M:%S %Z')}")
            
        except Exception as e:
            self.log(f"Failed to schedule recurring timer: {e}", level="ERROR")
    
    def calculate_next_execution(self, repeat_type: str, schedule_time: str, 
                                schedule_data: dict) -> Optional[datetime]:
        """计算下次执行时间（本地时区）"""
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
            if not month_days:
                return None
            
            # 找到下一个符合条件的日期
            current_year = now.year
            current_month = now.month
            current_day = now.day
            
            for month_offset in range(12):  # 最多检查12个月
                check_year = current_year + ((current_month - 1 + month_offset) // 12)
                check_month = ((current_month - 1 + month_offset) % 12) + 1
                
                # 获取该月的天数
                days_in_month = calendar.monthrange(check_year, check_month)[1]
                
                # 检查该月的每一天
                for day in month_days:
                    if day <= days_in_month:
                        # 创建日期对象
                        try:
                            check_date = self.tz.localize(datetime(
                                check_year, check_month, day, 0, 0, 0
                            ))
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
                                check_date = self.tz.localize(datetime(
                                    check_year, check_month, day, 0, 0, 0
                                ))
                                return self.parse_local_time(schedule_time, check_date)
                            except:
                                continue
            
            return None
        
        return None
    
    def parse_weekday(self, weekday_str: str) -> int:
        """将星期字符串转换为数字（0=周一，6=周日）"""
        weekday_map = {
            "monday": 0, "mon": 0,
            "tuesday": 1, "tue": 1,
            "wednesday": 2, "wed": 2,
            "thursday": 3, "thu": 3,
            "friday": 4, "fri": 4,
            "saturday": 5, "sat": 5,
            "sunday": 6, "sun": 6
        }
        
        weekday_lower = weekday_str.lower()
        return weekday_map.get(weekday_lower, 0)
    
    def weekday_to_string(self, weekday_num: int) -> str:
        """将数字转换为星期字符串"""
        weekday_names = [
            "Monday", "Tuesday", "Wednesday", "Thursday", 
            "Friday", "Saturday", "Sunday"
        ]
        return weekday_names[weekday_num]
    
    async def execute_recurring_schedule(self, kwargs):
        """执行周期定时任务"""
        schedule_id = kwargs["schedule_id"]
        
        if schedule_id not in self.tasks:
            self.log(f"Schedule {schedule_id} not found")
            return
        
        schedule_data = self.tasks[schedule_id]
        
        # 检查是否已禁用
        if schedule_data.get("status") != "active":
            self.log(f"Schedule {schedule_id} is not active, skipping execution")
            return
        
        try:
            entity_id = schedule_data["entity_id"]
            action_type = schedule_data.get("action_type", "auto")
            # 记录执行时间
            schedule_data["last_executed"] = self.datetime_to_iso(self.get_local_now())
            
            # 执行动作
            if schedule_data.get("is_climate"):
                # 空调任务
                action_data = schedule_data.get("action_data", {})
                action = self.generate_climate_action(entity_id, action_type, action_data)
                
                if action["type"] == "service_call":
                    domain, service = action["service"].split(".")
                    service_data = action.get("data", {}).copy()
                    
                    # 如果是恢复操作，使用保存的数据
                    if action_type == "restore_previous" and "restore_data" in action:
                        restore_data = action["restore_data"]
                        
                        # 恢复完整状态
                        if restore_data.get("temperature"):
                            await self.call_service(
                                "climate/set_temperature",
                                entity_id=entity_id,
                                temperature=restore_data["temperature"]
                            )
                        
                        if restore_data.get("fan_mode"):
                            await self.call_service(
                                "climate/set_fan_mode",
                                entity_id=entity_id,
                                fan_mode=restore_data["fan_mode"]
                            )
                        
                        # 最后设置模式
                        if restore_data.get("hvac_mode"):
                            await self.call_service(
                                "climate/set_hvac_mode",
                                entity_id=entity_id,
                                hvac_mode=restore_data["hvac_mode"]
                            )
                    else:
                        # 普通服务调用
                        await self.call_service(
                            f"{domain}/{service}",
                            **service_data
                        )
            else:
                # 通用任务
                
                # 使用异步方式获取设备状态，避免协程问题
                try:
                    # 直接使用异步方式获取状态
                    current_state = await self.get_state(entity_id)
                except Exception as e:
                    current_state = "unknown"
                
                try:
                    action = self.generate_action(entity_id, action_type, current_state)
                except Exception as e:
                    raise

                if action["type"] == "service_call":
                    domain, service = action["service"].split(".")
                    try:
                        await self.call_service(
                            f"{domain}/{service}",
                            **action.get("data", {})
                        )
                    except Exception as e:
                        raise
            
            self.log(f"Executed recurring schedule: {schedule_id} - {entity_id}")
            
            # 发送执行通知
            self.fire_event(
                "timer_backend_response",
                action="schedule_executed",
                schedule_id=schedule_id,
                entity_id=entity_id,
                entity_name=schedule_data["entity_name"],
                repeat_type=schedule_data["repeat_type"],
                message=f"Recurring schedule executed for {schedule_data['entity_name']}",
                time_zone=self.time_zone
            )
            
            # 重新安排下次执行
            self.reschedule_recurring_timer(schedule_id, schedule_data)
            
        except Exception as e:
            self.log(f"Failed to execute recurring schedule: {e}", level="ERROR")
            # 仍然尝试重新安排
            try:
                self.reschedule_recurring_timer(schedule_id, schedule_data)
            except Exception as reschedule_error:
                self.log(f"Failed to reschedule after error: {reschedule_error}", level="ERROR")
    
    def reschedule_recurring_timer(self, schedule_id: str, schedule_data: dict):
        """重新安排周期定时任务"""
        try:
            # 计算下次执行时间（本地时区）
            schedule_time = schedule_data["schedule_time"]
            
            next_execution = self.calculate_next_execution(
                schedule_data["repeat_type"],
                schedule_time,
                schedule_data
            )
            
            if not next_execution:
                self.log(f"Cannot calculate next execution for schedule {schedule_id}")
                return
            
            now = self.get_local_now()
            delay_seconds = (next_execution - now).total_seconds()
            
            # 取消旧的定时器
            if schedule_id in self.recurring_timers:
                old_handle = self.recurring_timers[schedule_id]
                try:
                    self.cancel_timer_handle(old_handle)
                except:
                    pass
            
            # 创建新定时器
            if delay_seconds > 0:
                timer_handle = self.run_in(
                    self.execute_recurring_schedule,
                    delay_seconds,
                    schedule_id=schedule_id
                )
                
                self.recurring_timers[schedule_id] = timer_handle
                schedule_data["next_execution"] = self.datetime_to_iso(next_execution)
                
                self.log(f"Rescheduled {schedule_data['repeat_type']} task for {schedule_data['entity_id']} at {next_execution.strftime('%Y-%m-%d %H:%M:%S %Z')}")
            else:
                # 如果延迟为负数，安排到明天检查
                self.log(f"Next execution is in the past for schedule {schedule_id}, will check tomorrow")
                schedule_data["next_execution"] = None
            
            self.save_tasks()
            
        except Exception as e:
            self.log(f"Failed to reschedule recurring timer: {e}", level="ERROR")
    
    def check_recurring_schedules(self, kwargs):
        """检查并重新安排所有周期任务（每日午夜执行，使用本地时区）"""
        try:
            self.log(f"Checking recurring schedules at {self.get_local_now().strftime('%Y-%m-%d %H:%M:%S %Z')}...")
            
            for schedule_id, schedule_data in self.tasks.items():
                if schedule_data.get("is_recurring") and schedule_data.get("status") == "active":
                    # 检查是否需要重新安排
                    next_execution_str = schedule_data.get("next_execution")
                    if not next_execution_str:
                        # 重新安排
                        self.schedule_recurring_timer(schedule_id, schedule_data)
                    else:
                        # 检查是否已过期
                        try:
                            next_execution = self.iso_to_datetime(next_execution_str)
                            now = self.get_local_now()
                            if next_execution <= now:
                                # 重新安排
                                self.schedule_recurring_timer(schedule_id, schedule_data)
                        except:
                            # 解析失败，重新安排
                            self.schedule_recurring_timer(schedule_id, schedule_data)
            
            self.log("Recurring schedules check completed")
            
        except Exception as e:
            self.log(f"Failed to check recurring schedules: {e}", level="ERROR")
    
    def generate_climate_action(self, entity_id, action_type="turn_off", action_data=None):
        """生成空调动作"""
        action_data = action_data or {}
        
        if action_type == "turn_off":
            return {
                "type": "service_call",
                "service": "climate.turn_off",
                "data": {"entity_id": entity_id},
                "description": "Turn off AC"
            }
            
        elif action_type == "set_temperature":
            temperature = action_data.get("temperature", self.climate_config["default_temperature"])
            hvac_mode = action_data.get("hvac_mode", self.climate_config["default_mode"])
            
            return {
                "type": "service_call",
                "service": "climate.set_temperature",
                "data": {
                    "entity_id": entity_id,
                    "temperature": temperature,
                    "hvac_mode": hvac_mode
                },
                "description": f"Set temperature to {temperature}°C"
            }
            
        elif action_type == "set_mode":
            mode = action_data.get("mode", "cool")
            temperature = action_data.get("temperature", self.climate_config["default_temperature"])
            
            return {
                "type": "service_call",
                "service": "climate.set_hvac_mode",
                "data": {
                    "entity_id": entity_id,
                    "hvac_mode": mode
                },
                "description": f"Set mode to {mode}"
            }
            
        elif action_type == "restore_previous":
            # 恢复之前的状态
            previous_state = self.climate_previous_states.get(entity_id, {})
            hvac_mode = previous_state.get("hvac_mode", "cool")
            temperature = previous_state.get("temperature", self.climate_config["default_temperature"])
            
            return {
                "type": "service_call",
                "service": "climate.set_hvac_mode",
                "data": {
                    "entity_id": entity_id,
                    "hvac_mode": hvac_mode
                },
                "restore_data": previous_state,
                "description": f"Restore previous state ({hvac_mode})"
            }
            
        elif action_type == "auto":
            # 智能判断：如果空调开着就关，如果关着就恢复之前状态或默认设置
            current_state = self.get_state(entity_id)
            if current_state == "off":
                return self.generate_climate_action(entity_id, "restore_previous")
            else:
                return self.generate_climate_action(entity_id, "turn_off")
        
        else:
            # 默认关闭
            return self.generate_climate_action(entity_id, "turn_off")
    
    async def execute_climate_timer(self, kwargs):
        """执行空调定时器"""
        timer_id = kwargs["timer_id"]
        
        if timer_id in self.tasks:
            timer = self.tasks[timer_id]
            entity_id = timer["entity_id"]
            
            # 检查定时器是否已被取消
            if timer.get("status") == "cancelled":
                self.log(f"Climate timer {timer_id} was cancelled, skipping execution")
                return
            
            try:
                # 执行动作
                action = timer["action"]
                success = False
                
                if action["type"] == "service_call":
                    domain, service = action["service"].split(".")
                    service_data = action.get("data", {}).copy()
                    
                    # 如果是恢复操作，使用保存的数据
                    if timer.get("action_type") == "restore_previous" and "restore_data" in action:
                        restore_data = action["restore_data"]
                        
                        # 恢复完整状态
                        if restore_data.get("temperature"):
                            await self.call_service(
                                "climate/set_temperature",
                                entity_id=entity_id,
                                temperature=restore_data["temperature"]
                            )
                        
                        if restore_data.get("fan_mode"):
                            await self.call_service(
                                "climate/set_fan_mode",
                                entity_id=entity_id,
                                fan_mode=restore_data["fan_mode"]
                            )
                        
                        # 最后设置模式
                        if restore_data.get("hvac_mode"):
                            await self.call_service(
                                "climate/set_hvac_mode",
                                entity_id=entity_id,
                                hvac_mode=restore_data["hvac_mode"]
                            )
                            
                        success = True
                    else:
                        # 普通服务调用
                        await self.call_service(
                            f"{domain}/{service}",
                            **service_data
                        )
                        success = True
                
                # 更新状态
                if success:
                    timer["status"] = "completed"
                    timer["executed_at"] = self.datetime_to_iso(self.get_local_now())
                else:
                    timer["status"] = "failed"
                
                # 清理
                if entity_id in self.entity_timers:
                    del self.entity_timers[entity_id]
                if timer_id in self.timers:
                    del self.timers[timer_id]
                
                self.save_tasks()
                
                # 发送通知
                self.fire_event(
                    "timer_backend_response",
                    action="timer_completed",
                    timer_id=timer_id,
                    entity_id=entity_id,
                    entity_name=timer["entity_name"],
                    success=success,
                    action_description=timer["action"].get("description", ""),
                    message=f"Climate timer executed for {timer['entity_name']}",
                    time_zone=self.time_zone
                )
                
                self.log(f"Climate timer executed successfully: {entity_id} - {timer['action'].get('description', '')}")
                
            except Exception as e:
                self.log(f"Failed to execute climate timer: {e}", level="ERROR")
                timer["status"] = "error"
                timer["error"] = str(e)
                self.save_tasks()
    
    def generate_action(self, entity_id, action_type="auto", current_state=None):
        """根据实体类型自动生成动作"""
        domain = entity_id.split(".")[0]
        
        # 如果没有传入状态，则获取当前状态
        if current_state is None:
            current_state = self.get_state(entity_id)
        
        # 空调特殊处理
        if domain == "climate":
            return self.generate_climate_action(entity_id, action_type)
        
        # 确保current_state是字符串类型
        if not isinstance(current_state, str):
            current_state = "unknown"
        
        if action_type == "auto":
            # 自动选择最合适的动作
            if domain == "light":
                return {
                    "type": "service_call",
                    "service": "light.turn_off" if current_state == "on" else "light.turn_on",
                    "data": {"entity_id": entity_id},
                    "description": "Turn off" if current_state == "on" else "Turn on"
                }
                    
            elif domain == "switch":
                return {
                    "type": "service_call",
                    "service": "switch.turn_off" if current_state == "on" else "switch.turn_on",
                    "data": {"entity_id": entity_id},
                    "description": "Turn off" if current_state == "on" else "Turn on"
                }
                    
            elif domain == "media_player":
                if current_state == "playing":
                    return {
                        "type": "service_call",
                        "service": "media_player.media_pause",
                        "data": {"entity_id": entity_id},
                        "description": "Pause playback"
                    }
                else:
                    return {
                        "type": "service_call",
                        "service": "media_player.turn_off",
                        "data": {"entity_id": entity_id},
                        "description": "Turn off"
                    }
            else:
                # 通用关闭动作
                return {
                    "type": "service_call",
                    "service": f"{domain}.turn_off",
                    "data": {"entity_id": entity_id},
                    "description": "Turn off"
                }
        
        elif action_type == "toggle":
            return {
                "type": "service_call",
                "service": f"{domain}.toggle",
                "data": {"entity_id": entity_id},
                "description": "Toggle state"
            }
        
        elif action_type == "turn_off":
            return {
                "type": "service_call",
                "service": f"{domain}.turn_off",
                "data": {"entity_id": entity_id},
                "description": "Turn off"
            }
        
        elif action_type == "turn_on":
            return {
                "type": "service_call",
                "service": f"{domain}.turn_on",
                "data": {"entity_id": entity_id},
                "description": "Turn on"
            }
    
    def parse_duration(self, duration_str):
        """解析时长字符串"""
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
        """获取动作描述"""
        return action.get("description", action.get("service", "Unknown action"))
    
    def get_climate_action_description(self, action):
        """获取空调动作描述"""
        desc = action.get("description", "")
        if action.get("service") == "climate.set_temperature":
            temp = action.get("data", {}).get("temperature")
            if temp:
                desc = f"Set temperature to {temp}°C"
        return desc
    
    def cancel_timer(self, timer_id):
        """取消指定定时器"""
        if timer_id in self.tasks:
            try:
                timer = self.tasks[timer_id]
                entity_id = timer["entity_id"]
                
                # 检查是否为周期任务
                if timer.get("is_recurring"):
                    return self.cancel_schedule(timer_id)
                
                # 无论timer_handle是否存在，都要取消
                if timer_id in self.timers:
                    timer_handle = self.timers[timer_id]
                    try:
                        # 尝试AppDaemon的取消方法
                        self.cancel_timer_handle(timer_handle)
                    except:
                        try:
                            # 如果是asyncio handle，使用其cancel方法
                            if hasattr(timer_handle, 'cancel'):
                                timer_handle.cancel()
                        except:
                            # 最后尝试直接调用cancel
                            pass
                    
                    # 清理定时器句柄
                    del self.timers[timer_id]
                
                # 更新状态
                timer["status"] = "cancelled"
                timer["cancelled_at"] = self.datetime_to_iso(self.get_local_now())
                
                # 彻底清理所有相关引用
                if entity_id in self.entity_timers and self.entity_timers[entity_id] == timer_id:
                    del self.entity_timers[entity_id]
                
                # 确保没有其他活跃的定时器使用相同实体
                self.cleanup_entity_timers(entity_id, timer_id)
                
                self.save_tasks()
                
                # 发送响应
                self.fire_event(
                    "timer_backend_response",
                    action="timer_cancelled",
                    timer_id=timer_id,
                    entity_id=entity_id,
                    entity_name=timer["entity_name"],
                    message=f"Timer cancelled for {timer['entity_name']}",
                    time_zone=self.time_zone
                )
                
                self.log(f"Timer cancelled: {timer_id} for entity: {entity_id}")
                
            except Exception as e:
                self.log(f"Failed to cancel timer: {e}", level="ERROR")
        else:
            self.log(f"Timer not found for cancellation: {timer_id}", level="WARNING")
    
    def cancel_schedule(self, schedule_id: str):
        """取消周期定时任务"""
        if schedule_id in self.tasks:
            try:
                schedule = self.tasks[schedule_id]
                
                if not schedule.get("is_recurring"):
                    self.log(f"Task {schedule_id} is not a recurring schedule")
                    return
                
                # 取消定时器
                if schedule_id in self.recurring_timers:
                    timer_handle = self.recurring_timers[schedule_id]
                    try:
                        self.cancel_timer_handle(timer_handle)
                    except:
                        try:
                            if hasattr(timer_handle, 'cancel'):
                                timer_handle.cancel()
                        except:
                            pass
                    del self.recurring_timers[schedule_id]
                
                # 更新状态
                schedule["status"] = "cancelled"
                schedule["cancelled_at"] = self.datetime_to_iso(self.get_local_now())
                
                self.save_tasks()
                
                # 发送响应
                self.fire_event(
                    "timer_backend_response",
                    action="schedule_cancelled",
                    schedule_id=schedule_id,
                    entity_id=schedule["entity_id"],
                    entity_name=schedule["entity_name"],
                    message=f"Schedule cancelled for {schedule['entity_name']}",
                    time_zone=self.time_zone
                )
                
                self.log(f"Schedule cancelled: {schedule_id}")
                
            except Exception as e:
                self.log(f"Failed to cancel schedule: {e}", level="ERROR")
        else:
            self.log(f"Schedule not found for cancellation: {schedule_id}", level="WARNING")
    
    def cleanup_entity_timers(self, entity_id, exclude_timer_id=None):
        """清理实体相关的所有定时器状态，排除指定的定时器ID"""
        # 检查entity_timers中是否有该实体的其他定时器引用
        if entity_id in self.entity_timers:
            referenced_timer_id = self.entity_timers[entity_id]
            if referenced_timer_id != exclude_timer_id:
                # 如果引用的不是当前取消的定时器，也需要处理
                if referenced_timer_id in self.tasks:
                    timer = self.tasks[referenced_timer_id]
                    if timer.get("status") == "active":
                        timer["status"] = "cancelled"
                        timer["cancelled_at"] = self.datetime_to_iso(self.get_local_now())
                        self.log(f"Cleaned up active timer from entity_timers: {referenced_timer_id}")
                
                # 清理引用
                del self.entity_timers[entity_id]
        
        # 检查是否还有其他使用相同实体的活跃定时器
        for timer_id, timer_data in list(self.tasks.items()):
            if (timer_id != exclude_timer_id and 
                timer_data.get("entity_id") == entity_id and 
                timer_data.get("status") == "active"):
                
                # 取消这些定时器
                if timer_id in self.timers:
                    timer_handle = self.timers[timer_id]
                    try:
                        self.cancel_timer_handle(timer_handle)
                    except:
                        try:
                            if hasattr(timer_handle, 'cancel'):
                                timer_handle.cancel()
                        except:
                            pass
                    del self.timers[timer_id]
                
                # 更新状态
                timer_data["status"] = "cancelled"
                timer_data["cancelled_at"] = self.datetime_to_iso(self.get_local_now())
                self.log(f"Cleaned up other active timers for same entity: {timer_id}")
    
    def cancel_entity_timer(self, entity_id, user_id=None):
        """取消实体相关的定时器"""
        cancelled_count = 0
        
        # 首先检查entity_timers中是否有该实体的定时器
        if entity_id in self.entity_timers:
            timer_id = self.entity_timers[entity_id]
            self.cancel_timer(timer_id)
            cancelled_count += 1
        
        # 然后检查tasks中是否有该实体的其他活跃定时器（防止遗漏）
        for timer_id, timer_data in list(self.tasks.items()):
            if (timer_data.get("entity_id") == entity_id and 
                timer_data.get("status") == "active"):
                
                # 避免重复取消
                if timer_id not in self.timers:
                    # 如果timers中没有但tasks中还有活跃状态，说明可能是遗漏的定时器
                    timer_data["status"] = "cancelled"
                    timer_data["cancelled_at"] = self.datetime_to_iso(self.get_local_now())
                    self.log(f"Cleaned up missed active timer: {timer_id}")
                    cancelled_count += 1
        
        if cancelled_count > 0:
            self.save_tasks()
            self.log(f"Cancelled {cancelled_count} timer(s) for entity: {entity_id}")
        else:
            self.log(f"No active timers found for entity: {entity_id}", level="INFO")
    
    def send_all_timers(self, user_id=None):
        """发送所有定时器状态"""
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
                            "action_type": timer.get("action_type", "auto"),
                            "time_zone": timer.get("time_zone", self.time_zone)
                        }
                        
                        # 添加特定类型信息
                        if timer["repeat_type"] == "weekly":
                            schedule_info["weekdays"] = timer.get("weekdays", [])
                        elif timer["repeat_type"] == "monthly":
                            schedule_info["month_days"] = timer.get("month_days", [])
                        
                        # 如果指定了用户，只返回该用户的定时器
                        if user_id and timer.get("created_by") != user_id:
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
                        "time_zone": self.time_zone
                    }
                    
                    # 如果是空调，添加额外信息
                    if timer.get("is_climate"):
                        timer_info["previous_mode"] = timer.get("previous_state", {}).get("hvac_mode", "Unknown")
                        timer_info["target_action"] = timer.get("action", {}).get("description", "Climate control")
                    
                    # 如果指定了用户，只返回该用户的定时器
                    if user_id and timer.get("created_by") != user_id:
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
                "time_zone": self.time_zone
            }
            
            success = self.fire_event(
                "timer_backend_response",
                **event_data
            )
            
            # 保存可能的更改（如定时器过期）
            if any(timer.get("status") == "completed" for timer in self.tasks.values()):
                self.save_tasks()
            
        except Exception as e:
            self.log(f"Failed to send timers list: {e}", level="ERROR")
    
    def send_all_schedules(self, user_id=None):
        """发送所有周期任务状态"""
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
                        "action_type": timer.get("action_type", "auto"),
                        "time_zone": timer.get("time_zone", self.time_zone)
                    }
                    
                    # 添加特定类型信息
                    if timer["repeat_type"] == "weekly":
                        schedule_info["weekdays"] = timer.get("weekdays", [])
                    elif timer["repeat_type"] == "monthly":
                        schedule_info["month_days"] = timer.get("month_days", [])
                    
                    # 如果指定了用户，只返回该用户的定时器
                    if user_id and timer.get("created_by") != user_id:
                        continue
                    
                    active_schedules.append(schedule_info)
            
            # 发送事件
            event_data = {
                "action": "schedules_list",
                "schedules": active_schedules,
                "count": len(active_schedules),
                "source": "timer_backend",
                "timestamp": self.datetime_to_iso(self.get_local_now()),
                "time_zone": self.time_zone
            }
            
            self.fire_event("timer_backend_response", **event_data)
            
        except Exception as e:
            self.log(f"Failed to send schedules list: {e}", level="ERROR")
    
    def get_friendly_name(self, entity_id):
        """获取实体友好名称"""
        state = self.get_state(entity_id, attribute="friendly_name")
        return state or entity_id
    
    async def execute_timer(self, kwargs):
        """执行通用定时器"""
        timer_id = kwargs["timer_id"]
        
        if timer_id in self.tasks:
            timer = self.tasks[timer_id]
            entity_id = timer["entity_id"]
            
            # 检查定时器是否已被取消
            if timer.get("status") == "cancelled":
                self.log(f"Timer {timer_id} was cancelled, skipping execution")
                return
            
            try:
                action = timer["action"]
                success = False
                
                if action["type"] == "service_call":
                    domain, service = action["service"].split(".")
                    await self.call_service(
                        f"{domain}/{service}",
                        **action.get("data", {})
                    )
                    success = True
                
                # 更新状态
                if success:
                    timer["status"] = "completed"
                    timer["executed_at"] = self.datetime_to_iso(self.get_local_now())
                else:
                    timer["status"] = "failed"
                
                # 清理
                if entity_id in self.entity_timers:
                    del self.entity_timers[entity_id]
                if timer_id in self.timers:
                    del self.timers[timer_id]
                
                self.save_tasks()
                
                # 发送通知
                self.fire_event(
                    "timer_backend_response",
                    action="timer_completed",
                    timer_id=timer_id,
                    entity_id=entity_id,
                    entity_name=timer["entity_name"],
                    success=success,
                    message=f"Timer executed for {timer['entity_name']}",
                    time_zone=self.time_zone
                )
                
                # 记录执行结果
                if success:
                    self.log(f"Timer executed successfully: {entity_id} - {timer['action'].get('description', '')}")
                else:
                    self.log(f"Timer execution failed: {entity_id}", level="ERROR")
                
            except Exception as e:
                self.log(f"Failed to execute timer: {e}", level="ERROR")
                timer["status"] = "error"
                timer["error"] = str(e)
                self.save_tasks()
    
    def terminate(self):
        """应用终止"""
        self.save_tasks()
        self.log("Timer backend stopped")