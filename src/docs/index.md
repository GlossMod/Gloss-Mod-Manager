---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "Gloss Mod Manager"
  # text: "A VitePress Site"
  tagline: "一款综合性的现代化游戏模组管理器"
  actions:
    - theme: brand
      text: 开始使用
      link: /README.md
    - theme: alt
      text: 安装Mod
      link: /Install
    - theme: alt
      text: 下载
      link: "https://mod.3dmgame.com/mod/197445?for=download"
    - theme: alt
      text: 微软应用商店
      link: "https://apps.microsoft.com/detail/9p5vgz39pk6t"
  image:
    src: "https://mod.3dmgame.com/static/upload/mod/202405/MOD663ed1e5509eb.png@webp"
    # width: "200px"
    alt: "Gloss Mod Manager"

features:
  - title: 这是什么？
    details: "Gloss Mod Manager (GMM) 是一款综合性的现代化游戏模组管理器.是一款功能强大的综合性游戏Mod管理器, 它为游戏玩家提供了简单易用的方式来管理和安装各种游戏Mod."
  - title: 特性
    details: "自适应语言, 自适应主题, 简洁的 UI, 没有多余的内容和囊肿的广告, 简单的安装和下载, 便捷的游览、下载 Mod, 令人舒适的动画, 程序无毒无捆绑, 功能全部免费开放"
  - title: 支持的语言
    details: "简体中文 <br/>
繁体中文 <br/>
English <br/>
Türkçe by:sinnerclown <br/>
Vietnamese by:TQ34"



---

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: -webkit-linear-gradient(120deg, #bd34fe 30%, #41d1ff);

  --vp-home-hero-image-background-image: linear-gradient(-45deg, #bd34fe 50%, #47caff 50%);
  --vp-home-hero-image-filter: blur(44px);
}

@media (min-width: 640px) {
  :root {
    --vp-home-hero-image-filter: blur(56px);
  }
}

@media (min-width: 960px) {
  :root {
    --vp-home-hero-image-filter: blur(68px);
  }
}
</style>