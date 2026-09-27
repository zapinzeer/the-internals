window.Internals = window.Internals || {};

Internals.cpu = {
  die: {
    w: 120,
    h: 80,
    regions: [
      { id: "core", color: "#e38b4f" },
      { id: "l3", color: "#a594f5" },
      { id: "gpu", color: "#5ac8e2" },
      { id: "mem", color: "#72d49c" },
      { id: "io", color: "#d8b25a" }
    ],
    blocks: (function () {
      const b = [];
      for (let i = 0; i < 4; i++) {
        b.push(["core", 4 + i * 18.5, 4, 17, 25]);
        b.push(["core", 4 + i * 18.5, 51, 17, 25]);
      }
      b.push(["l3", 4, 31, 72.5, 18]);
      b.push(["gpu", 80, 4, 36, 46]);
      b.push(["mem", 80, 52, 36, 11]);
      b.push(["io", 80, 65, 36, 11]);
      return b;
    })()
  },

  parts: [
    { id: "ihs", color: "#c9ccd1" },
    { id: "tim", color: "#9aa4ae" },
    { id: "die", color: "#e38b4f" },
    { id: "substrate", color: "#3f8a5c" },
    { id: "pads", color: "#d8b25a" }
  ]
};
