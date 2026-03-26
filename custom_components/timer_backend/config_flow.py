"""Config flow for 定时精灵 integration."""
from __future__ import annotations

import logging
import os
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant, callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers.selector import (
    TextSelector,
    TextSelectorConfig,
    TextSelectorType,
    ObjectSelector,
)

from .const import (
    DOMAIN,
    CONF_PERSIST_FILE,
    CONF_TIME_ZONE,
    CONF_DEFAULT_ACTIONS,
    DEFAULT_PERSIST_FILE,
    DEFAULT_TIME_ZONE,
)

_LOGGER = logging.getLogger(__name__)


async def validate_input(hass: HomeAssistant, data: dict[str, Any]) -> dict[str, Any]:
    """验证用户输入."""
    # 检查持久化文件目录是否存在
    persist_file = data[CONF_PERSIST_FILE]
    directory = os.path.dirname(persist_file)

    if directory and not os.path.exists(directory):
        try:
            os.makedirs(directory, exist_ok=True)
        except OSError as err:
            raise ValueError(f"无法创建目录 {directory}: {err}")

    # 测试是否可以写入文件位置
    if os.path.exists(persist_file):
        if not os.access(persist_file, os.W_OK):
            raise ValueError(f"没有写入权限 {persist_file}")
    else:
        # 检查是否可以创建文件
        try:
            with open(persist_file, 'a'):
                pass
        except OSError as err:
            raise ValueError(f"无法创建文件 {persist_file}: {err}")

    return {"title": "定时精灵"}


STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_PERSIST_FILE, default=DEFAULT_PERSIST_FILE): TextSelector(
            TextSelectorConfig(type=TextSelectorType.TEXT)
        ),
        vol.Optional(CONF_TIME_ZONE, default=DEFAULT_TIME_ZONE): TextSelector(
            TextSelectorConfig(type=TextSelectorType.TEXT)
        ),
        # 默认动作配置（高级选项）
        vol.Optional(CONF_DEFAULT_ACTIONS, default={}): ObjectSelector(),
    }
)


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """处理定时精灵的配置流程."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """处理初始步骤."""
        # 检查是否已存在配置条目
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        errors: dict[str, str] = {}
        if user_input is not None:
            try:
                info = await validate_input(self.hass, user_input)
            except ValueError as err:
                errors["base"] = str(err)
            except Exception:  # pylint: disable=broad-except
                _LOGGER.exception("意外异常")
                errors["base"] = "未知错误"
            else:
                return self.async_create_entry(title=info["title"], data=user_input)

        return self.async_show_form(
            step_id="user", data_schema=STEP_USER_DATA_SCHEMA, errors=errors
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> config_entries.OptionsFlow:
        """创建选项流程."""
        return OptionsFlowHandler(config_entry)


class OptionsFlowHandler(config_entries.OptionsFlow):
    """处理定时精灵的选项流程."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """初始化选项流程."""
        # 调用父类初始化方法
        super().__init__()
        self._config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """管理选项."""
        errors: dict[str, str] = {}

        if user_input is not None:
            try:
                await validate_input(self.hass, user_input)
            except ValueError as err:
                errors["base"] = str(err)
            except Exception:  # pylint: disable=broad-except
                _LOGGER.exception("意外异常")
                errors["base"] = "未知错误"
            else:
                return self.async_create_entry(title="", data=user_input)

        # 使用当前配置值填充表单
        current_config = self._config_entry.options or self._config_entry.data

        options_schema = vol.Schema(
            {
                vol.Optional(
                    CONF_PERSIST_FILE,
                    msg="timer_tasks.json文件存储位置",
                    default=current_config.get(CONF_PERSIST_FILE, DEFAULT_PERSIST_FILE),
                ): TextSelector(TextSelectorConfig(type=TextSelectorType.TEXT)),
                vol.Optional(
                    CONF_TIME_ZONE,
                    msg="时区",
                    default=current_config.get(CONF_TIME_ZONE, DEFAULT_TIME_ZONE),
                ): TextSelector(TextSelectorConfig(type=TextSelectorType.TEXT)),
                # 默认动作配置（高级选项，可选）
                vol.Optional(
                    CONF_DEFAULT_ACTIONS,
                    msg="默认动作配置（高级选项，可选）",
                    default=current_config.get(CONF_DEFAULT_ACTIONS, {}),
                ): ObjectSelector(),
            }
        )

        return self.async_show_form(
            step_id="init", data_schema=options_schema, errors=errors
        )
