"""定时精灵集成 for Home Assistant."""
from __future__ import annotations

import logging
from datetime import timedelta

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.typing import ConfigType
from homeassistant.helpers.event import async_track_time_interval

# 显式导入配置流以确保注册
from . import config_flow  # noqa: F401
from .coordinator import TimerBackendCoordinator
from .const import (
    DOMAIN,
    CONF_PERSIST_FILE,
    CONF_TIME_ZONE,
    CONF_DEFAULT_ACTIONS,
    DEFAULT_PERSIST_FILE,
    DEFAULT_TIME_ZONE,
)

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR]


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """设置定时精灵集成."""
    _LOGGER.debug("设置定时精灵集成")
    hass.data.setdefault(DOMAIN, {})
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """从配置条目设置定时精灵."""
    _LOGGER.debug(f"设置定时精灵配置条目: {entry.entry_id}")
    hass.data.setdefault(DOMAIN, {})

    # 获取配置（优先使用entry.data，如果不存在则使用entry.options）
    config_source = entry.data if entry.data else entry.options
    persist_file = config_source.get(CONF_PERSIST_FILE, DEFAULT_PERSIST_FILE)
    time_zone = config_source.get(CONF_TIME_ZONE, DEFAULT_TIME_ZONE)
    
    # 使用配置的default_actions，如果没有则使用默认值
    from .const import DEFAULT_DEFAULT_ACTIONS
    config_default_actions = config_source.get(CONF_DEFAULT_ACTIONS, {})
    default_actions = {**DEFAULT_DEFAULT_ACTIONS, **config_default_actions}

    # Create coordinator
    coordinator = TimerBackendCoordinator(
        hass,
        persist_file=persist_file,
        time_zone=time_zone,
        default_actions=default_actions,
    )

    # Restore tasks and start coordinator
    await coordinator.async_setup()

    # Store coordinator
    hass.data[DOMAIN][entry.entry_id] = coordinator

    # Setup platforms
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Setup services
    await async_setup_services(hass, coordinator)

    # Setup HTTP API
    from .api import async_setup_api
    await async_setup_api(hass, coordinator)

    # Track midnight check
    async def midnight_check(_):
        await coordinator.check_recurring_schedules()

    async_track_time_interval(
        hass, midnight_check, timedelta(days=1), cancel_on_shutdown=True
    )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    coordinator: TimerBackendCoordinator = hass.data[DOMAIN].pop(entry.entry_id)
    await coordinator.async_unload()

    # Unload platforms
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    # Remove services
    await async_unload_services(hass)

    return unload_ok


async def async_setup_services(hass: HomeAssistant, coordinator: TimerBackendCoordinator) -> None:
    """Set up services."""

    async def create_timer(call):
        """Create a timer."""
        data = call.data
        await coordinator.create_timer({
            "entity_id": data["entity_id"],
            "duration": data.get("duration", "00:30:00"),
            "action_type": data.get("action_type", "auto"),
            "user_id": call.context.user_id,
        })

    async def create_climate_timer(call):
        """Create a climate timer."""
        data = call.data
        await coordinator.create_climate_timer({
            "entity_id": data["entity_id"],
            "duration": data.get("duration", "01:00:00"),
            "action_type": data.get("action_type", "turn_off"),
            "action_data": data.get("action_data", {}),
            "user_id": call.context.user_id,
        })

    async def create_schedule(call):
        """Create a recurring schedule."""
        data = call.data
        await coordinator.create_schedule({
            "entity_id": data["entity_id"],
            "repeat_type": data["repeat_type"],
            "schedule_time": data["schedule_time"],
            "action_type": data.get("action_type", "auto"),
            "action_data": data.get("action_data", {}),
            "weekdays": data.get("weekdays", []),
            "month_days": data.get("month_days", []),
            "user_id": call.context.user_id,
        })

    async def cancel_timer(call):
        """Cancel a timer."""
        await coordinator.cancel_timer(call.data["timer_id"])

    async def cancel_schedule(call):
        """Cancel a schedule."""
        await coordinator.cancel_schedule(call.data["schedule_id"])

    async def cancel_entity_timer(call):
        """Cancel entity timer."""
        await coordinator.cancel_entity_timer(
            call.data["entity_id"], call.context.user_id
        )

    async def get_timers(call):
        """Get all timers."""
        await coordinator.send_all_timers(call.context.user_id)

    async def get_schedules(call):
        """Get all schedules."""
        await coordinator.send_all_schedules(call.context.user_id)

    hass.services.async_register(DOMAIN, "create_timer", create_timer)
    hass.services.async_register(DOMAIN, "create_climate_timer", create_climate_timer)
    hass.services.async_register(DOMAIN, "create_schedule", create_schedule)
    hass.services.async_register(DOMAIN, "cancel_timer", cancel_timer)
    hass.services.async_register(DOMAIN, "cancel_schedule", cancel_schedule)
    hass.services.async_register(DOMAIN, "cancel_entity_timer", cancel_entity_timer)
    hass.services.async_register(DOMAIN, "get_timers", get_timers)
    hass.services.async_register(DOMAIN, "get_schedules", get_schedules)

    # Store service handlers for cleanup
    hass.data[DOMAIN]["services"] = {
        "create_timer": create_timer,
        "create_climate_timer": create_climate_timer,
        "create_schedule": create_schedule,
        "cancel_timer": cancel_timer,
        "cancel_schedule": cancel_schedule,
        "cancel_entity_timer": cancel_entity_timer,
        "get_timers": get_timers,
        "get_schedules": get_schedules,
    }


async def async_unload_services(hass: HomeAssistant) -> None:
    """Unload services."""
    services = hass.data[DOMAIN].pop("services", {})
    for service_name in services:
        hass.services.async_remove(DOMAIN, service_name)


async def async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload config entry."""
    await async_unload_entry(hass, entry)
    await async_setup_entry(hass, entry)
