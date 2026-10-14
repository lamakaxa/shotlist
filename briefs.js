// Career briefs — balance data, one new lighting pattern per level (L3).
// match weights: how strongly each axis counts toward the brief score.
export const BRIEFS = [
  {
    id: "test",
    client: "Агентство «Noir Models»",
    channel: "pr",
    title: "Тест агентства: чистый бьюти-портрет",
    teaches: "Бабочка / paramount — один ключевой строго спереди-сверху.",
    shots: 5,
    threshold: 0.62,
    fee: 600,
    rep: 8,
    // target light schema (angles in deg from front, 0=front; height cm; softness 0..1)
    target: {
      keyAngle: 0, keyHeight: 215, keySoft: 0.75, keyCone: 55,
      ratio: 3.0,            // key:fill contrast in :1
      rim: false,
      exposure: 0,           // target EV offset
      bodyTurn: 0, headTurn: 0,
    },
    weights: { angle: 1.0, height: 0.8, soft: 0.7, ratio: 0.9, rim: 0.6, exposure: 0.8, pose: 0.5 },
  },
  {
    id: "loop",
    client: "Журнал «Haifa Edit»",
    channel: "editorial",
    title: "Лукбук: петлевой свет, мягкая тень от носа",
    teaches: "Loop — ключевой сбоку 30–45°, лёгкая петля тени.",
    shots: 6,
    threshold: 0.66,
    fee: 1100,
    rep: 12,
    target: {
      keyAngle: 38, keyHeight: 195, keySoft: 0.7, keyCone: 50,
      ratio: 3.5, rim: false, exposure: 0, bodyTurn: 12, headTurn: -8,
    },
    weights: { angle: 1.1, height: 0.8, soft: 0.7, ratio: 1.0, rim: 0.6, exposure: 0.8, pose: 0.8 },
  },
  {
    id: "rembrandt",
    client: "Бренд «Terra Wear»",
    channel: "editorial",
    title: "Кампания: рембрандтовский треугольник",
    teaches: "Rembrandt — ключевой 45° и выше, треугольник света на щеке.",
    shots: 6,
    threshold: 0.70,
    fee: 1800,
    rep: 16,
    target: {
      keyAngle: 46, keyHeight: 210, keySoft: 0.55, keyCone: 42,
      ratio: 4.5, rim: false, exposure: 0, bodyTurn: 18, headTurn: -14,
    },
    weights: { angle: 1.2, height: 1.0, soft: 0.8, ratio: 1.1, rim: 0.6, exposure: 0.8, pose: 1.0 },
  },
  {
    id: "editorial_rim",
    client: "Обложка «RED NOIR»",
    channel: "pr",
    title: "Обложка: драматичный ключ + контровой рим",
    teaches: "Editorial — жёсткий боковой ключ, контровой за моделью, низкий fill.",
    shots: 7,
    threshold: 0.73,
    fee: 3000,
    rep: 24,
    target: {
      keyAngle: 58, keyHeight: 200, keySoft: 0.4, keyCone: 36,
      ratio: 6.0, rim: true, rimAngle: 150, rimHeight: 210,
      exposure: 0, bodyTurn: 22, headTurn: -18,
    },
    weights: { angle: 1.2, height: 1.0, soft: 0.9, ratio: 1.2, rim: 1.4, exposure: 0.9, pose: 1.1 },
  },
];
