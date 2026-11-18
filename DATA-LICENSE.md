# 地图数据许可 · Map Data License

本仓库中的地图数据（下称“数据”）来自 **OpenStreetMap**，并按 **Open Database License 1.0（ODbL）** 提供。

The map data in this repository (the “Data”) comes from **OpenStreetMap** and is made available under the **Open Database License 1.0 (ODbL)**.

- 数据版权 / Data copyright: **© OpenStreetMap contributors**
- 许可 / License: **ODbL 1.0** — <https://opendatacommons.org/licenses/odbl/1-0/>
- 官方版权页 / Copyright page: <https://www.openstreetmap.org/copyright>
- 许可全文 / Full text: [`LICENSES/ODbL-1.0.txt`](LICENSES/ODbL-1.0.txt)

## 哪些文件属于“数据”

- `src/js/05-osm.js`：裁切、投影、简化后的 OSM 建筑 / 道路 / 步行道 / 岸线 / 绿地 / POI 数据。
- `src/js/06-shenxi.js`：对岸（申西）建筑轮廓数据。
- `modu-nightrun.html`、`dist/modu-nightrun.html` 中内联的上述数据。
- 由上述数据进一步加工得到的衍生数据库（例如改名后的地物表、投影后的坐标表）。

## 对数据做了哪些修改

- 只保留约 2.5 × 2.2 km 的滨江区域；
- 经纬度投影为本地米制坐标（+x 东、+z 南）；
- 几何做了裁剪、简化与少量手工修补；
- **地名、建筑名、店铺名、品牌名被系统性改写为虚构名称**（这是衍生数据库的一部分，仍受 ODbL 约束）；
- 删除了部分与玩法无关的要素。

## ODbL 的核心义务

1. **署名**：向使用者显示 “© OpenStreetMap contributors”，并尽可能链接到 <https://www.openstreetmap.org/copyright>。本作在标题页和游戏内手册中显示该署名。
2. **相同方式共享（Share-Alike）**：如果你分发本数据或它的衍生数据库，必须继续以 ODbL 1.0 提供，不得附加额外限制。
3. **保持开放**：不得对数据或衍生数据库施加技术措施或法律条款来限制 ODbL 已授予的权利。

## 与项目“非商用”许可的关系（重要）

- 本仓库的 **代码、文案和程序化生成的资产** 使用 **PolyForm Noncommercial 1.0.0**（见 [`LICENSE`](LICENSE)），**仅限非商业用途**。
- 但 **OSM 数据及其衍生数据库不适用该非商用许可**。ODbL 不允许对数据再附加“仅限非商用”等额外限制；ODbL 本身也允许商业使用。
- 因此本仓库采用 **分许可**：
  - 代码 / 文案 / 生成资产：PolyForm Noncommercial 1.0.0（非商用）；
  - 地图数据：ODbL 1.0（可商用，但必须署名并以 ODbL 共享衍生数据库）。
- 如果你只使用代码、不复制 `05-osm.js` / `06-shenxi.js` 中的数据，则 ODbL 不适用于你；如果你复制了数据，请遵守 ODbL。
- “Produced Work”（渲染画面、截图、视频）可以按项目条款发布，但必须保留 OSM 署名。

## 数据来源与时间

- 来源：OpenStreetMap（Overpass API / OSM 主数据），提取时间约 **2026 年 11 月**。
- 为减少对现实位置的直接披露，本仓库不公开原始 bbox 与投影原点；这并不改变 ODbL 的义务。
- OSM 数据由志愿者维护，可能存在错误或过时信息；本作不保证其准确性。

---

*This notice is not legal advice. If you redistribute the Data, read the full ODbL text and the OSM attribution guidelines: <https://osmfoundation.org/wiki/Licence/Attribution_Guidelines>.*
