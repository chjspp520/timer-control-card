"""定时精灵集成常量."""

DOMAIN = "timer_backend"

# 配置项
CONF_PERSIST_FILE = "persist_file"
CONF_TIME_ZONE = "time_zone"
CONF_DEFAULT_ACTIONS = "default_actions"

# 默认值
DEFAULT_PERSIST_FILE = "/config/www/timer_tasks.json"
DEFAULT_TIME_ZONE = "Asia/Shanghai"

# 默认动作配置（内置默认值，用户配置会与这些值合并）
DEFAULT_DEFAULT_ACTIONS = {
    "light": {
        "turn_off": {
            "service": "light.turn_off",
            "description": "关闭灯光"
        },
        "turn_on": {
            "service": "light.turn_on",
            "description": "打开灯光"
        }
    },
    "switch": {
        "turn_off": {
            "service": "switch.turn_off",
            "description": "关闭开关"
        },
        "turn_on": {
            "service": "switch.turn_on",
            "description": "打开开关"
        }
    },
    "media_player": {
        "turn_off": {
            "service": "media_player.turn_off",
            "description": "关闭播放器"
        },
        "pause": {
            "service": "media_player.media_pause",
            "description": "暂停播放"
        }
    },
    "climate": {
        "turn_off": {
            "service": "climate.turn_off",
            "description": "关闭空调"
        },
        "set_temperature": {
            "service": "climate.set_temperature",
            "description": "设置温度"
        },
        "set_mode": {
            "service": "climate.set_hvac_mode",
            "description": "设置模式"
        }
    },
    "input_boolean": {
        "turn_off": {
            "service": "input_boolean.turn_off",
            "description": "关闭布尔值"
        },
        "turn_on": {
            "service": "input_boolean.turn_on",
            "description": "打开布尔值"
        },
        "toggle": {
            "service": "input_boolean.toggle",
            "description": "切换布尔值"
        }
    }
}

# 信号
SIGNAL_UPDATE_SENSOR = f"{DOMAIN}_update_sensor"

# 属性
ATTR_ACTIVE_TASKS = "active_tasks"
ATTR_TOTAL_TASKS = "total_tasks"
ATTR_ACTIVE_TIMERS = "active_timers"
ATTR_ACTIVE_SCHEDULES = "active_schedules"
ATTR_CURRENT_TASK = "current_task"
ATTR_SUCCESSFUL_TASK = "successful_task"
ATTR_FAILED_TASK = "failed_task"
ATTR_TODAY_TASK = "today_task"
ATTR_ALL_TASK_LIST = "all_task_list"

# 历史记录配置
MAX_HISTORY_RECORDS = 100
