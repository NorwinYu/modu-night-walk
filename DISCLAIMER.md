# 免责声明与技术定位 · Disclaimer

## 中文

### 1. 技术演示，不发行，不是游戏产品

**发行状态：不发行（NOT FOR RELEASE）。** 本仓库只公开源码，供技术研究与学习；没有官方 Release、安装包或下载站，也不提供任何形式的发行、运营或商业服务。公开源码不等于授权发行或运营。

《魔都夜行》是一个**单文件 WebGL / Three.js 技术演示**，用于研究以下工程问题：

- 大规模 OpenStreetMap 几何的裁剪、投影、简化与实时渲染；
- 程序化城市（建筑、道路、街具、招牌、纹理、天气、灯光）的生成管线；
- 第一/第三人称移动、载具、寻路、交互与移动端适配；
- 单文件、零网络请求的离线打包与性能取舍。

它**不是**以商业发行、运营或盈利为目的的游戏产品（本文中“游戏”“玩法”均指该可交互演示）：不提供下载分发、账号、充值、广告、联机、排行榜、用户生成内容或任何在线服务；不收集、不上传任何个人信息。任何 fork 或再分发都不得以本项目官方名义发行或运营。

### 2. 虚构声明

- 城市称“魔都”，道路、建筑、店铺、银行、酒店、媒体账号、人物、委托与事件均为**虚构或经过改写**，仅用于叙事和视觉设计。
- 与现实中的任何个人、企业、机构、品牌、事件**不存在**关联、赞助、授权或背书关系；如有雷同，纯属巧合。
- 地图几何来自 OpenStreetMap（© OpenStreetMap contributors，ODbL 1.0），但地名与建筑名已做改写；少量真实地理特征（江岸线、路网、建筑体量）仍可能被识别，这是数据可视化研究的需要。
- 项目中**不含**任何真实个人的姓名、电话、邮箱、住址、身份证号、人脸照片或其他个人信息；联系人均为虚构角色。

### 3. 内容说明

- 本作不含暴力、血腥、犯罪、武器、毒品、赌博、色情或政治宣传内容；故事以“雨夜帮人跑腿、想办法回家”为核心。
- 场景中出现热红酒、酒吧、烟杂店等成人生活元素，仅为城市氛围与体力恢复道具；游戏明确阻止“喝过酒开车”。
- 驾驶玩法中的闯红灯、超速、不礼让行人会被扣分罚款，不鼓励危险驾驶。
- 无人机航拍是虚构玩法。**现实中**请遵守《无人驾驶航空器飞行管理暂行条例》及当地禁飞、限飞规定，不要在城市核心区、机场净空区、人群上空违规飞行。

### 4. 地图与游戏合规

- 本作**不是地图服务**，不用于导航、测绘、定位或任何安全关键用途；OSM 数据可能存在错误、缺失或过时。
- 在中国境内公开发布含地图的出版物、游戏或应用，可能涉及《中华人民共和国测绘法》《地图管理条例》等要求（例如地图审核、审图号、正确表示国家版图）。本项目不声称已完成任何审核。
- 如将本作作为游戏在中国境内发行或运营，可能涉及网络游戏审批、备案、未成年人保护、实名认证等要求；这些义务由发行/运营方自行评估和承担。
- 本项目不构成法律意见；如有商业发行计划，请咨询专业律师。

### 5. 许可

- 原创代码、文案和程序化生成资产：**PolyForm Noncommercial License 1.0.0**（仅限非商业用途），见 [`LICENSE`](LICENSE)。
- 地图数据：**ODbL 1.0**（允许商业使用，但必须署名并以 ODbL 共享衍生数据库），见 [`DATA-LICENSE.md`](DATA-LICENSE.md)。
- Three.js：MIT，见 [`THIRD-PARTY-NOTICES.md`](THIRD-PARTY-NOTICES.md)。
- 因此，本项目属于**源码公开（source-available）**，不是 OSI 定义的开源项目；如需真正的开源许可，可仅将代码改为 MIT/Apache-2.0（数据仍需 ODbL）。

### 6. 无担保

本作按“现状”提供，不附带任何明示或默示担保，包括但不限于适销性、特定用途适用性和不侵权担保。使用本作或其代码所产生的任何风险与后果，由使用者自行承担。

---

## English

### Technical demo — not for release

**Release status: NOT FOR RELEASE.** This repository publishes source code for technical research and learning only. There is no official Release, installer or download channel, and no distribution, operation or commercial service. Public source code does not grant permission to release or operate the work.

*MODU NIGHT WALK* is a single-file WebGL / Three.js **technical demo** exploring OSM geometry processing, procedural city generation, real-time rendering, interaction design and offline packaging. It is **not** a commercial game product and provides no distribution, accounts, payments, ads, multiplayer, leaderboards, user-generated content or online services. It collects no personal data. Forks and redistributions must not present themselves as official releases.

### Fictional work

The city, streets, buildings, shops, banks, hotels, media accounts, characters, errands and events are fictional or rewritten for narrative and visual design. They are not affiliated with, sponsored by or endorsed by any real person, company, institution or brand. Map geometry is derived from OpenStreetMap (© OpenStreetMap contributors, ODbL 1.0); names have been rewritten. No real personal data is included.

### Content

The work contains no violence, gore, crime, weapons, drugs, gambling, sexual content or political propaganda. Alcohol and tobacco appear only as ambient city details; drunk driving is explicitly blocked, and traffic violations are penalised. Drone flight is fictional — follow real-world aviation and no-fly-zone rules.

### Maps and games

This is **not a map service** and must not be used for navigation, surveying or safety-critical purposes. Publishing maps or games in mainland China may require map review (审图号), game approval/filing and minor-protection measures; this project claims no such approvals. Nothing here is legal advice.

### Licensing

Original code and content: PolyForm Noncommercial 1.0.0 (non-commercial only). Map data: ODbL 1.0. Three.js: MIT. The project is therefore **source-available**, not OSI open source.

### No warranty

Provided “as is”, without warranty of any kind. Use at your own risk.
