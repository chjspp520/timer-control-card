# Timer Control Card - Home Assistant 定时器控制卡片

## 🎯 项目背景与动机

**智者造物，以简驭繁。**  
智能家居之定时，乃日用常需。然传统之法，操作繁复，界面难明，功能单一，移动不便。  

**尤以设备管理为患：**  
- 灯、扇、空调、媒体，各立门户，操作不一  
- 定时任务，散落四方，难以统辖  
- 周期任务，配置繁琐，管理维艰  

**吾辈制此卡片，旨在化繁为简：**  
- 翻页钟表，一目了然  
- 设备分类，择之便捷  
- 周期定时，省心省力  
- 空调智能，冷暖自知  
- 响应设计，大小皆宜  
- **总揽全局，定时皆归一处**
- 
**工具之妙，在于简朴。集中管理，方显智慧。**  

---

## 功能特性

### 🕒 核心功能
- **倒计时定时器**：为设备设置倒计时定时任务
- **周期定时任务**：支持每日、每周、每月周期定时
- **空调智能控制**：自动保存和恢复空调状态，支持温度、模式设置
- **多设备支持**：灯光、开关、媒体播放器、风扇、空调等
- **实时同步**：与后端 AppDaemon 应用实时同步状态

### 🎨 界面特色
- **两种显示模式**：Mini（紧凑）和 Normal（完整）
- **响应式设计**：完美适配桌面端和移动端
- **翻页钟控件**：优雅的时间输入界面
- **设备分类选择**：按设备类型智能分类
- **搜索功能**：快速查找设备
- **进度条显示**：实时显示定时器进度

### 🔧 高级功能
- **自动重连机制**：网络异常时自动恢复连接
- **状态持久化**：重启后自动恢复定时任务
- **多时区支持**：支持配置不同的时区设置
- **错误处理**：完善的错误提示和恢复机制

## 安装要求

### 后端应用配置
在 AppDaemon 的 `apps.yaml` 中添加：

```yaml
appdaemon:
  latitude: 34.26111                          #位置坐标，随便写
  longitude: 108.94222                       #位置坐标，随便写
  elevation: 400                             #位置高度，随便写
  time_zone:Asia/Shanghai                   #时区，按照此项填写
  plugins:
    HASS:
      type: hass
      token: !env_varSUPERVISOR_TOKEN      #单独安装填写长期TOKEN，加载项按照此方法
```

## 安装方法

### 1. 后端应用安装 (AppDaemon)

#### 下载 timer_backend.py 文件
将 `timer_backend.py` 文件复制到 AppDaemon 的 `apps` 目录下，例如：
```
/homeassistant/appdaemon/apps/timer_backend.py
```

#### 配置 apps.yaml
在 AppDaemon 的 `apps.yaml` 配置文件中添加：

```yaml
timer_backend:
  module: timer_backend
  class: TimerBackend
  event_name: "timer_backend_event"
  default_actions:
    light:
      turn_off:
        service: light.turn_off
      turn_on:
        service: light.turn_on
    switch:
      turn_off:
        service: switch.turn_off
      turn_on:
        service: switch.turn_on
    media_player:
      turn_off:
        service: media_player.turn_off
      pause:
        service: media_player.media_pause
    climate:
      turn_off:
        service: climate.turn_off
      set_temperature:
        service: climate.set_temperature
      set_mode:
        service: climate.set_hvac_mode
```

#### 重启 AppDaemon
配置完成后重启 AppDaemon 服务以加载后端应用：

### 2. 前端卡片安装

#### 下载 timer-control-card.js 文件
将 `timer-control-card.js` 文件复制到 Home Assistant 的 `www` 目录下，例如：
`config/www/chj/timer-control-card.js`

#### 配置资源引用
在 Lovelace 仪表板的资源配置中添加：

```yaml
resources:
  - url: /local/chj/timer-control-card.js
    type: module
```

### 3. 添加卡片到仪表板
使用 YAML 编辑器或 UI 配置器添加卡片：

```yaml
type: custom:timer-control-card
entity: light.ertongfang_xidingdeng
default_duration: "01:30:00"
time_box_font_size: 12px
time_box_width: 70px
time_box_height: 15px
time_box_background: "#a8c97f"
time_box_progress_background: "#2792c3"
status_indicator_color: "#28a745"
status_indicator_width: 10px
status_indicator_height: 10px
start_btn_color: "#a8c97f"
start_btn_width: 27px
start_btn_height: 27px
cancel_btn_color: "#dc3545"
cancel_btn_width: 30px
cancel_btn_height: 30px
show_buttons: true
timer_running_border_color: "#00a3af"
timer_running_border_width: 1px
card_style: mini
second_style: pull-down
timer_running_border: 2px solid#82b1ff

```

## 配置选项

### 基本配置
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `entity` | string | - | 默认设备实体ID |
| `card_style` | string | `mini` | 显示模式：`mini` 或 `normal` |
| `default_duration` | string | `00:30:00` | 默认时长 (HH:MM:SS) |

### 样式配置
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `time_box_font_size` | string | `20px` | 时间框字体大小 |
| `time_box_background` | string | `#f8f9fa` | 时间框背景色 |
| `time_box_progress_background` | string | `#1976d2` | 进度条颜色 |
| `start_btn_color` | string | `#28a745` | 开始按钮颜色 |
| `cancel_btn_color` | string | `#dc3545` | 取消按钮颜色 |
| `show_buttons` | boolean | `true` | 是否显示按钮 |

### 高级配置
| 参数 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `second_style` | string | `normal` | 时间框样式：`normal` 或 `pull-down` |
| `timer_running_border` | string | `1px solid #1976d2` | 定时器运行时的边框 |

## 使用方法

### 基础定时
1. **选择设备**：点击设备选择区域，从下拉列表中选择目标设备
2. **设置时间**：使用翻页钟或快速时长按钮设置倒计时时间
3. **启动定时**：点击绿色开始按钮启动定时器
4. **取消定时**：定时器运行时可点击红色取消按钮取消

### 周期定时
1. **切换到周期模式**：在设置面板中选择周期定时模式
2. **选择周期类型**：每日、每周或每月
3. **设置具体时间**：选择执行的具体时间点
4. **配置参数**：
   - **每周**：选择执行的具体星期几
   - **每月**：选择执行的日期
5. **保存周期任务**：创建后会自动按周期执行

### 空调控制
- **智能模式**：自动判断当前状态，关闭时恢复之前设置，开启时关闭
- **温度控制**：可设置特定温度
- **模式切换**：支持制冷、制热、通风等模式（下一个版本支持）
- **状态保存**：定时时自动保存当前空调状态

## 设备分类

卡片自动将设备按类型分类：

### 🏠 灯光 (Lights)
- 排除：指示灯、屏幕灯、氛围灯、LED灯、背光灯
- 智能过滤，只显示主要照明设备

### ❄️ 空调/加湿器 (Climate/Humidifier)
- 支持所有 climate.* 和 humidifier.* 实体
- 完整的空调控制功能

### 🌬️ 风扇 (Fan)
- 支持所有 fan.* 实体
- 基本的开关控制

### 📺 媒体播放器 (Media Player)
- 过滤 unavailable 状态的设备
- 支持播放/暂停控制（下一个版本支持）

### 🔌 开关 (Switch)
- 支持所有 switch.* 实体
- 基本的开关控制

### v1.0.0 (当前版本)
- ✅ 基础倒计时功能
- ✅ 周期定时任务
- ✅ 空调智能控制
- ✅ 响应式界面设计
- ✅ 设备分类和搜索
- ✅ 多时区支持
- ✅ 错误恢复机制


---

**注意**：使用本卡片前请确保已正确安装和配置后端 `timer_backend.py` 应用，否则定时功能将无法正常工作。****
