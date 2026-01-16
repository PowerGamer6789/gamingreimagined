window.ads = [
  { img: "/ads/escaperoad.png", href: "/game/?id=2" },
  { img: "/ads/undertale.png", href: "/game/?id=1" },
  { img: "/ads/ovo.png", href: "/game/?id=3" },
  { img: "/ads/feedback.png" },
  { img: "/ads/subwaysurfers.png", href: "/game/?id=5" },
  { img: "/ads/thereisnogame.png", href: "/game/?id=6" },
  { img: "/ads/eggycar.png", href: "/game/?id=7" },
  { img: "/ads/bloxorz.png", href: "/game/?id=8" },
  { img: "/ads/starlight.png", href: "https://starlight.webconstructions.co.uk" },
];

// shuffle
for (let i = window.ads.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [window.ads[i], window.ads[j]] = [window.ads[j], window.ads[i]];
}
