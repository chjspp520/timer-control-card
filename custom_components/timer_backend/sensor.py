"""定时精灵传感器平台."""
from __future__ import annotations

from datetime import timedelta
import logging
from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity
from homeassistant.util import dt as dt_util

from .const import (
    DOMAIN,
    SIGNAL_UPDATE_SENSOR,
    ATTR_ACTIVE_TASKS,
    ATTR_ACTIVE_TIMERS,
    ATTR_ACTIVE_SCHEDULES,
    ATTR_TOTAL_TASKS,
    ATTR_CURRENT_TASK,
    ATTR_SUCCESSFUL_TASK,
    ATTR_FAILED_TASK,
    ATTR_TODAY_TASK,
    ATTR_ALL_TASK_LIST,
)

_LOGGER = logging.getLogger(__name__)

SCAN_INTERVAL = timedelta(seconds=30)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """根据配置条目设置定时精灵传感器."""
    coordinator = hass.data[DOMAIN][config_entry.entry_id]

    # 创建传感器
    sensor = TimerBackendSensor(coordinator, config_entry)

    # 添加到Home Assistant
    async_add_entities([sensor], True)

    # 初始更新
    await sensor.async_update()


class TimerBackendSensor(SensorEntity, RestoreEntity):
    """定时精灵传感器."""

    def __init__(self, coordinator, config_entry):
        """初始化传感器."""
        self.coordinator = coordinator
        self.config_entry = config_entry
        self._state = 0
        self._attrs = {
            ATTR_ACTIVE_TIMERS: 0,
            ATTR_ACTIVE_SCHEDULES: 0,
            ATTR_TOTAL_TASKS: 0,
            ATTR_CURRENT_TASK: 0,
            ATTR_SUCCESSFUL_TASK: 0,
            ATTR_FAILED_TASK: 0,
            ATTR_TODAY_TASK: 0,
            ATTR_ALL_TASK_LIST: [],
        }

    @property
    def name(self) -> str:
        """返回传感器名称."""
        return "Timer Active Tasks"

    @property
    def unique_id(self) -> str:
        """返回唯一ID."""
        return "timer_active_tasks"

    @property
    def state(self) -> int:
        """返回传感器状态."""
        return self._state

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """返回状态属性."""
        return self._attrs

    @property
    def should_poll(self) -> bool:
        """如果需要轮询实体状态则返回True."""
        return True

    @property
    def available(self) -> bool:
        """如果实体可用则返回True."""
        return True

    @property
    def icon(self) -> str:
        """返回前端使用的图标."""
        return "mdi:timer-outline"

    async def async_added_to_hass(self) -> None:
        """处理将要添加的实体."""
        await super().async_added_to_hass()

        # 恢复之前的状态
        if (last_state := await self.async_get_last_state()) and last_state.state:
            try:
                self._state = int(last_state.state)
                if last_state.attributes:
                    self._attrs.update(last_state.attributes)
            except (ValueError, TypeError):
                pass

        # 注册更新监听器
        self.async_on_remove(
            async_dispatcher_connect(
                self.hass, SIGNAL_UPDATE_SENSOR, self._handle_update
            )
        )

    @callback
    def _handle_update(self, data: dict[str, Any]) -> None:
        """处理来自协调器的更新."""
        self._state = data.get("active_tasks", 0)
        self._attrs.update(
            {
                ATTR_ACTIVE_TIMERS: data.get("active_timers", 0),
                ATTR_ACTIVE_SCHEDULES: data.get("active_schedules", 0),
                ATTR_TOTAL_TASKS: data.get("total_tasks", 0),
                ATTR_CURRENT_TASK: data.get("current_task", 0),
                ATTR_SUCCESSFUL_TASK: data.get("successful_task", 0),
                ATTR_FAILED_TASK: data.get("failed_task", 0),
                ATTR_TODAY_TASK: data.get("today_task", 0),
                ATTR_ALL_TASK_LIST: data.get("all_task_list", []),
            }
        )
        self.async_write_ha_state()

    async def async_update(self) -> None:
        """更新传感器."""
        # 强制从协调器更新
        await self.coordinator._update_sensor()

    @property
    def device_info(self):
        """返回设备信息."""
        return {
            "identifiers": {(DOMAIN, self.config_entry.entry_id)},
            "name": "定时精灵",
            "manufacturer": "Custom",
            "model": "Timer Backend Integration",
            "configuration_url": "https://github.com/chjspp520/timer-control-card",
        }
