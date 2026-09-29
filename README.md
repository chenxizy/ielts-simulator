# 雅思机考界面模拟器

本项目的界面、代码、文档和示例内容均由 OpenAI Codex 按用户要求生成。项目采用 [MIT License](LICENSE) 开源，与 IELTS、IDP 及其所属机构无隶属关系。

本地练习用网页，参考 [IDP IELTS Familiarisation Test](https://ielts.idp.com/about/ielts-familiarisation-tests) 与 [IELTS 官网 Practice Experience](https://www.ielts.org/take-a-test/test-types/ielts-academic-test/ielts-online) 的界面。支持听力、阅读、写作，题目由本地文件导入。打开网页不会上传你的试题。

## 启动

Windows 上双击 [`启动模拟器.cmd`](启动模拟器.cmd)，会启动本地服务，并自动使用系统默认浏览器打开。重复双击会复用已运行的模拟器；如果默认端口被占用，会自动尝试备用端口。需要已安装 Node.js。

也可以在本目录手动运行：

```powershell
npm start
```

手动启动后，浏览器打开 `http://localhost:4173`。无需安装项目依赖。首页会自动列出本地题库；也可以点击“查看内置示例”了解界面，或临时导入其他试卷。

## 本地题库

默认从项目根目录下的 `试题` 文件夹读取试卷，即 `<项目根目录>/试题/`。以后放入试卷时，可按以下结构整理：

```text
ielts-simulator/
└─ 试题/
   └─ Cambridge IELTS 20 Academic/
      ├─ Test 1/
      │  ├─ exam.json
      │  └─ assets/
      ├─ Test 2/
      ├─ Test 3/
      └─ Test 4/
```

放在项目外的题目文件夹不会被默认读取。若暂时要读取其他目录，可将 `IELTS_QUESTIONS_DIR` 设为该目录的绝对路径。

启动后点击首页“本地题库”中的 Test 即可进入听力、阅读或写作；新放入的试卷点击“刷新列表”。图片从对应 Test 的 `assets/` 自动关联。音频不是必需文件：缺少音频的听力 Part 会明确提示，题目仍可作答。以后把 `L-P1.mp3` 至 `L-P4.mp3` 放进相应 Test 的 `assets/`，刷新网页后即可播放。

需要使用别的题库目录时，在启动前设置环境变量 `IELTS_QUESTIONS_DIR` 为该目录的绝对路径。题库仅由运行在本机的服务读取，不会上传。

## 固定导入格式

把一套试卷整理为一个文件夹：

```text
我的试卷/
├─ exam.json
└─ assets/
   ├─ L-P1.mp3       听力 Part 1 音频
   ├─ L-P2.mp3       听力 Part 2 音频
   ├─ L-P3.mp3
   ├─ L-P4.mp3
   ├─ R07.png        阅读第 7 题的图
   ├─ R07-2.png      阅读第 7 题的第二张图，可选
   └─ W01.png        写作 Task 1 图表
```

`exam.json` 是 UTF-8 编码的**纯文本 JSON**。题目、文章、指令、答案都写在里面；图片、音频单独存文件。素材可以放在 `assets/` 下的任意子目录，程序按**文件名**匹配，无须在 JSON 里填写路径。

### 题号与素材文件名

| 内容 | 固定格式 | 示例 |
| --- | --- | --- |
| 听力题号 | `L` + 两位数字 | `L01` 至 `L40` |
| 阅读题号 | `R` + 两位数字 | `R01` 至 `R40` |
| 写作题号 | `W` + 两位数字 | `W01`、`W02` |
| 听力 Part 编号／音频 | `L-P1` 至 `L-P4` + 扩展名 | `L-P1.mp3` |
| 题目配图 | 题号 + 扩展名 | `R07.png`、`W01.jpg` |
| 一题多图 | 题号 + `-2`、`-3`… | `R07-2.png` |
| Part 共用图，可选 | Part 编号 + 扩展名 | `R-P1.png`、`L-P2.png` |

支持的图片扩展名：`.png`、`.jpg`、`.jpeg`、`.webp`、`.svg`、`.gif`。音频扩展名：`.mp3`、`.m4a`、`.wav`、`.ogg`。推荐图片用 PNG，音频用 MP3。某道题没有图片时，不需要创建空文件。若同一图对应多题，可以按其中首题命名；需要在多个位置显示时，复制并分别按题号命名。

请勿让两个不同子目录里出现同名素材；导入时会拒绝同名文件，并提示没有匹配题号或 Part 的素材文件名。

### JSON 结构

可直接复制 [`template/exam.json`](template/exam.json) 并替换占位文字。该模板已有听力 4 Part／40 题、阅读 3 Part／40 题、写作 2 Task 的全部固定题号。不同题型的具体写法见 [`examples/exam.json`](examples/exam.json)。

顶层格式：

```json
{
  "schemaVersion": 1,
  "id": "my-ielts-mock-001",
  "title": "我的雅思模拟试卷 001",
  "testType": "academic",
  "modules": [
    { "kind": "listening", "durationMinutes": null, "parts": [] },
    { "kind": "reading", "durationMinutes": null, "parts": [] },
    { "kind": "writing", "durationMinutes": null, "parts": [] }
  ]
}
```

- `schemaVersion` 固定为 `1`。
- `id` 是试卷唯一英文编号；不同试卷不要共用同一编号，否则本地作答记录会共用。
- `testType` 可为 `academic` 或 `general`。
- `durationMinutes` 写 `null` 表示不限时，写整数则开启倒计时。
- 不需要某模块时，可以从 `modules` 中删除它。
- 每个 Part 的 `id` 固定依次为 `L-P1`、`R-P1`、`W-P1` 等；`title`、`instructions`、`passageTitle`、`passage` 都是纯文字。文章用两个换行分段（JSON 中写 `\n\n`）。

每个 Part 的 `groups` 是题组列表。每题必须有唯一的 `id` 和 `type`。支持：

| `type` | 用途 | 额外字段 |
| --- | --- | --- |
| `text` | 单词、数字、短语填空 | `answer` 可为文字或同义答案数组 |
| `single_choice` | 单选 | `options` 文字数组，`answer` 为其中一项 |
| `multiple_choice` | 多选 | `options`、`maxChoices`、`answer` 数组 |
| `select` | 下拉选择／匹配 | `options`、`answer` |
| `true_false_not_given` | TRUE/FALSE/NOT GIVEN | `answer` |
| `yes_no_not_given` | YES/NO/NOT GIVEN | `answer` |
| `essay` | 写作输入框 | 仅用于写作，无须 `answer` |

客观题的 `answer` 可省略；省略时仍可作答，但结果页无法核对该题。写作只保存答案和显示字数，不自动评分。

题组的 `layout` 有两种：

1. `list`：逐题显示；每题必须填写 `prompt`。
2. `inline`：在题组 `content` 中用 `{{L01}}`、`{{R07}}` 等插入答题框。`questions` 中仍须逐一声明这些题号。适合表格、笔记、段落填空。`content` 中可用 `\n` 换行，仍是纯文字。

例如：

```json
{
  "title": "Questions 7–8",
  "instructions": "Write ONE WORD ONLY.",
  "layout": "inline",
  "content": "First item: {{R07}}\nSecond item: {{R08}}",
  "questions": [
    { "id": "R07", "type": "text", "answer": "garden" },
    { "id": "R08", "type": "text", "answer": ["centre", "center"] }
  ]
}
```

如果第 7 题有图，保存为 `R07.png` 即可，JSON 无须增加任何图片字段。

## 导入与检查

1. 先编辑 `exam.json`，把音频和图片按上表命名后放进同一试卷文件夹。
2. 网页点击“导入试卷文件夹”，选择整个文件夹；导入器会检查 JSON 字段、题号、题型及填空占位符，并提示缺少的音频。
3. 作答内容和笔记保存在当前浏览器的本地存储中。更改同一试卷的内容时，建议修改 `id`，以免沿用旧答案。
4. 如果先只导入了 JSON，可在考试页面的 Options 中点击“补充导入图片／音频”。

命令行可运行 `npm test` 检查内置示例和导入规则。模板可通过 `node generate-template.mjs` 重新生成。
