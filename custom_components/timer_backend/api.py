"""HTTP API for Timer Backend."""
from __future__ import annotations

import logging
from typing import Any

from aiohttp import web
from homeassistant.components.http import HomeAssistantView
from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


class TimerBackendAPIView(HomeAssistantView):
    """HTTP API View for Timer Backend."""

    name = "api:timer_backend"
    url = "/api/timer_backend"

    requires_auth = True  # 需要认证

    def __init__(self, hass: HomeAssistant, coordinator) -> None:
        """Initialize the view."""
        self.hass = hass
        self.coordinator = coordinator

    async def get(self, request: web.Request) -> web.Response:
        """Handle GET request - Get all tasks."""
        try:
            # 获取查询参数
            entity_id = request.query.get("entity_id")
            
            if entity_id:
                # 获取指定实体的任务
                tasks = await self._get_entity_tasks(entity_id)
                return self.json({
                    "success": True,
                    "entity_id": entity_id,
                    "tasks": tasks
                })
            else:
                # 获取所有任务
                all_tasks = await self._get_all_tasks()
                return self.json({
                    "success": True,
                    "tasks": all_tasks,
                    "count": len(all_tasks)
                })
                
        except Exception as e:
            _LOGGER.error(f"API GET error: {e}")
            return self.json({"success": False, "error": str(e)}, status_code=500)

    async def post(self, request: web.Request) -> web.Response:
        """Handle POST request - Create timer or schedule."""
        try:
            data = await request.json()
            action = data.get("action", "create_timer")
            
            if action == "create_timer":
                return await self._create_timer(data)
            elif action == "create_schedule":
                return await self._create_schedule(data)
            elif action == "create_climate_timer":
                return await self._create_climate_timer(data)
            elif action == "cancel_timer":
                return await self._cancel_timer(data)
            elif action == "cancel_schedule":
                return await self._cancel_schedule(data)
            elif action == "cancel_entity_timer":
                return await self._cancel_entity_timer(data)
            elif action == "get_timers":
                return await self._get_timers()
            elif action == "get_schedules":
                return await self._get_schedules()
            elif action == "get_entity_tasks":
                return await self._get_entity_tasks_api(data)
            else:
                return self.json({"success": False, "error": f"Unknown action: {action}"}, status_code=400)
                
        except Exception as e:
            _LOGGER.error(f"API POST error: {e}")
            return self.json({"success": False, "error": str(e)}, status_code=500)

    async def delete(self, request: web.Request) -> web.Response:
        """Handle DELETE request - Cancel timer or schedule."""
        try:
            data = await request.json()
            timer_id = data.get("timer_id")
            schedule_id = data.get("schedule_id")
            entity_id = data.get("entity_id")
            
            if timer_id:
                return await self._cancel_timer({"timer_id": timer_id})
            elif schedule_id:
                return await self._cancel_schedule({"schedule_id": schedule_id})
            elif entity_id:
                return await self._cancel_entity_timer({"entity_id": entity_id})
            else:
                return self.json({"success": False, "error": "Missing timer_id, schedule_id or entity_id"}, status_code=400)
                
        except Exception as e:
            _LOGGER.error(f"API DELETE error: {e}")
            return self.json({"success": False, "error": str(e)}, status_code=500)

    # ========== 创建任务 ==========

    async def _create_timer(self, data: dict) -> web.Response:
        """创建普通定时器."""
        try:
            entity_id = data.get("entity_id")
            duration = data.get("duration", "00:30:00")
            action_type = data.get("action_type", "auto")
            action_data = data.get("action_data", {})
            
            if not entity_id:
                return self.json({"success": False, "error": "entity_id is required"}, status_code=400)
            
            timer_data = {
                "entity_id": entity_id,
                "duration": duration,
                "action_type": action_type,
                "action_data": action_data,
                "user_id": "api_user"
            }
            
            result = await self.coordinator.create_timer(timer_data)
            
            return self.json({
                "success": True,
                "message": "Timer created successfully",
                "timer": result
            })
            
        except Exception as e:
            _LOGGER.error(f"Create timer error: {e}")
            return self.json({"success": False, "error": str(e)}, status_code=500)

    async def _create_climate_timer(self, data: dict) -> web.Response:
        """创建空调定时器."""
        try:
            entity_id = data.get("entity_id")
            duration = data.get("duration", "01:00:00")
            action_type = data.get("action_type", "turn_off")
            action_data = data.get("action_data", {})
            
            if not entity_id:
                return self.json({"success": False, "error": "entity_id is required"}, status_code=400)
            
            timer_data = {
                "entity_id": entity_id,
                "duration": duration,
                "action_type": action_type,
                "action_data": action_data,
                "user_id": "api_user"
            }
            
            result = await self.coordinator.create_climate_timer(timer_data)
            
            return self.json({
                "success": True,
                "message": "Climate timer created successfully",
                "timer": result
            })
            
        except Exception as e:
            _LOGGER.error(f"Create climate timer error: {e}")
            return self.json({"success": False, "error": str(e)}, status_code=500)

    async def _create_schedule(self, data: dict) -> web.Response:
        """创建周期任务."""
        try:
            entity_id = data.get("entity_id")
            repeat_type = data.get("repeat_type", "daily")
            schedule_time = data.get("schedule_time", "08:00:00")
            action_type = data.get("action_type", "auto")
            action_data = data.get("action_data", {})
            weekdays = data.get("weekdays", [])
            month_days = data.get("month_days", [])
            
            if not entity_id:
                return self.json({"success": False, "error": "entity_id is required"}, status_code=400)
            
            schedule_data = {
                "entity_id": entity_id,
                "repeat_type": repeat_type,
                "schedule_time": schedule_time,
                "action_type": action_type,
                "action_data": action_data,
                "weekdays": weekdays,
                "month_days": month_days,
                "user_id": "api_user"
            }
            
            result = await self.coordinator.create_schedule(schedule_data)
            
            return self.json({
                "success": True,
                "message": "Schedule created successfully",
                "schedule": result
            })
            
        except Exception as e:
            _LOGGER.error(f"Create schedule error: {e}")
            return self.json({"success": False, "error": str(e)}, status_code=500)

    # ========== 取消任务 ==========

    async def _cancel_timer(self, data: dict) -> web.Response:
        """取消定时器."""
        try:
            timer_id = data.get("timer_id")
            
            if not timer_id:
                return self.json({"success": False, "error": "timer_id is required"}, status_code=400)
            
            await self.coordinator.cancel_timer(timer_id)
            
            return self.json({
                "success": True,
                "message": f"Timer {timer_id} cancelled successfully"
            })
            
        except Exception as e:
            _LOGGER.error(f"Cancel timer error: {e}")
            return self.json({"success": False, "error": str(e)}, status_code=500)

    async def _cancel_schedule(self, data: dict) -> web.Response:
        """取消周期任务."""
        try:
            schedule_id = data.get("schedule_id")
            
            if not schedule_id:
                return self.json({"success": False, "error": "schedule_id is required"}, status_code=400)
            
            await self.coordinator.cancel_schedule(schedule_id)
            
            return self.json({
                "success": True,
                "message": f"Schedule {schedule_id} cancelled successfully"
            })
            
        except Exception as e:
            _LOGGER.error(f"Cancel schedule error: {e}")
            return self.json({"success": False, "error": str(e)}, status_code=500)

    async def _cancel_entity_timer(self, data: dict) -> web.Response:
        """取消指定实体的所有任务."""
        try:
            entity_id = data.get("entity_id")
            
            if not entity_id:
                return self.json({"success": False, "error": "entity_id is required"}, status_code=400)
            
            await self.coordinator.cancel_entity_timer(entity_id, "api_user")
            
            return self.json({
                "success": True,
                "message": f"All tasks for {entity_id} cancelled successfully"
            })
            
        except Exception as e:
            _LOGGER.error(f"Cancel entity timer error: {e}")
            return self.json({"success": False, "error": str(e)}, status_code=500)

    # ========== 查询任务 ==========

    async def _get_timers(self) -> web.Response:
        """获取所有定时器."""
        try:
            timers = []
            schedules = []
            
            for task_id, task_data in self.coordinator.tasks.items():
                if task_data.get("is_recurring"):
                    schedules.append(task_data)
                elif task_data.get("status") == "active":
                    timers.append(task_data)
            
            return self.json({
                "success": True,
                "timers": timers,
                "timer_count": len(timers),
                "schedules": schedules,
                "schedule_count": len(schedules)
            })
            
        except Exception as e:
            _LOGGER.error(f"Get timers error: {e}")
            return self.json({"success": False, "error": str(e)}, status_code=500)

    async def _get_schedules(self) -> web.Response:
        """获取所有周期任务."""
        try:
            schedules = []
            
            for task_id, task_data in self.coordinator.tasks.items():
                if task_data.get("is_recurring") and task_data.get("status") == "active":
                    schedules.append(task_data)
            
            return self.json({
                "success": True,
                "schedules": schedules,
                "count": len(schedules)
            })
            
        except Exception as e:
            _LOGGER.error(f"Get schedules error: {e}")
            return self.json({"success": False, "error": str(e)}, status_code=500)

    async def _get_entity_tasks_api(self, data: dict) -> web.Response:
        """获取指定实体的任务."""
        try:
            entity_id = data.get("entity_id")
            
            if not entity_id:
                return self.json({"success": False, "error": "entity_id is required"}, status_code=400)
            
            tasks = await self._get_entity_tasks(entity_id)
            
            return self.json({
                "success": True,
                "entity_id": entity_id,
                "tasks": tasks,
                "count": len(tasks)
            })
            
        except Exception as e:
            _LOGGER.error(f"Get entity tasks error: {e}")
            return self.json({"success": False, "error": str(e)}, status_code=500)

    async def _get_entity_tasks(self, entity_id: str) -> list:
        """获取指定实体的任务."""
        tasks = []
        
        for task_id, task_data in self.coordinator.tasks.items():
            if task_data.get("entity_id") == entity_id:
                tasks.append(task_data)
        
        return tasks

    async def _get_all_tasks(self) -> list:
        """获取所有任务."""
        return list(self.coordinator.tasks.values())


async def async_setup_api(hass: HomeAssistant, coordinator) -> None:
    """Set up the HTTP API."""
    view = TimerBackendAPIView(hass, coordinator)
    hass.http.register_view(view)
    _LOGGER.info("Timer Backend HTTP API registered at /api/timer_backend")
