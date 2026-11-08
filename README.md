# 上奏

给嘉靖、康熙、雍正写一道折子，等皇帝亲笔回你。

**在线体验：https://fengyiqicoder.github.io/shangzou/**

![雍正朱批：田文鏡這奴才做事倒也勤懇……](screenshots/shot-yongzheng.jpg)

## 怎么玩

1. **择主**：嘉靖、康熙、雍正三选一。
2. **具衔**：选年份、官职，填姓名。清朝可选旗人（自称「奴才」）或汉臣（自称「臣」）。
3. **陈事**：用白话写你要奏的事，师爷替你誊成该朝体例的文言奏文。不想誊也可以原话直呈。
4. **封折上奏**：看折子一站站流转，最后皇帝朱批（明朝是票拟加批红）发还。

| 嘉靖：票拟 + 批红 | 流转：雍正七年后才有军机处 |
|---|---|
| ![嘉靖批红](screenshots/shot-jiajing.jpg) | ![流转动画](screenshots/shot-flow.jpg) |

## 尽量照史实做的地方

- **竖写，自右向左，经折装。** 每幅六行，每行十八字左右。原件不加标点，页面上的句读小点可以关掉。
- **抬头。** 写到「皇上」「聖恩」「諭旨」一类字眼，另起一行，高出正文两格。
- **「臣」字偏书。** 自称的「臣」「奴才」写小，偏在右侧。
- **三朝三种流转路线：**
  - 嘉靖：具本 → 通政使司 → 会极门 → 内阁票拟（首辅按年份换人：杨廷和、张璁、夏言、严嵩、徐阶……）→ 西苑御览（嘉靖二十一年后）→ 司礼监批红 → 六科抄发，或者留中不发。
  - 康熙：缮折 → 封匣 → 驿递（按官职驻地算日程）→ 奏事处 → 御前 → 朱批 → 发还。
  - 雍正：同上，但雍正七年（1729）以后多一站军机处；朱批奏折阅后依例缴回宫中。
- **皇帝只知道当年为止的事。** 选嘉靖四十五年，海瑞的《治安疏》刚把他骂过一回；选康熙四十八年，他只知道太子刚废又复立，不知道三年后还会再废。
- **朱批的口吻。** 康熙短而亲切（「朕安。知道了。雨水如何？」）；雍正动辄上百字，会夹批、圈点、骂人；嘉靖的批红是明代公文白话（「這廝妄言惑眾，著革了職為民」）。

批语是 AI 模拟的，不是真实档案。

## 怎么做的

一个纯静态页面，没有后端，GitHub Pages 托管。AI 调用只有一行 script：

```html
<script src="https://onetagai.com/v1.js" data-key="YOUR_ONETAG_KEY"></script>
<script type="module">
  const reply = await onetag.ask("你是雍正皇帝，朱批这道奏折", document.querySelector("#zhe"), { json: true });
</script>
```

[OneTag AI](https://onetagai.com) 让静态网页直接调用大模型，key 写在页面里就行。

| 文件 | 内容 |
|---|---|
| `data.js` | 三位皇帝的史实年表、性情、官职、文书体例、流转路线 |
| `app.js` | 竖排排版（抬头、偏书、句读）、调用 AI、流转动画、朱批书写动画 |
| `style.css` | 宣纸、折匣、朱砂 |
| `config.js` | OneTag AI key |

## 自己部署一份

1. Fork 这个仓库，在 Settings → Pages 里选 main 分支根目录。
2. `config.js` 里默认是共享的演示 key，每天有总额度。换成你自己的免费 key（一个邮箱一把，100 万 token）：

```bash
curl -X POST https://onetagai.com/api/signup -H "Content-Type: application/json" -d '{"email":"you@example.com"}'
```

key 会发到邮箱，填进 `config.js` 即可。

想加一位皇帝（比如乾隆、朱元璋），在 `data.js` 的 `EMPERORS` 里照样加一项，写年表、性情和 `route()` 里的流转路线。欢迎 PR。

## License

MIT
