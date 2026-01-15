const ads = [
  { img: "/ads/escaperoad.png", href: "/escaperoad" },
  { img: "/ads/undertale.png", href: "/undertale" },
  { img: "/ads/ovo.png", href: "/ovo" },
  { img: "/ads/feedback.png" },
  { img: "/ads/subwaysurfers.png", href: "/subwaysurfers" },
  { img: "/ads/thereisnogame.png", href: "/thereisnogame" },
  { img: "/ads/eggycar.png", href: "/eggycar" },
  { img: "/ads/bloxorz.png", href: "/bloxorz" },
  { img: "/ads/starlight.png", href: "https://starlight.webconstructions.co.uk" },
];

// Fisher–Yates shuffle
for (let i = ads.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [ads[i], ads[j]] = [ads[j], ads[i]];
}

console.log(ads);
