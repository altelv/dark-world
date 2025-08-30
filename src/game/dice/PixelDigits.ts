// Simple 3×5 pixel font rendered into a 16×16 canvas, scaled with crisp edges.
// We draw digits 0-9; for 10–20 we place two digits.
export function drawPixelNumber(ctx: CanvasRenderingContext2D, value: number, color = "#FFFFFF") {
  const DIGITS: Record<string, string[]> = {
    "0": [
      "111",
      "101",
      "101",
      "101",
      "111",
    ],
    "1": ["010","110","010","010","111"],
    "2": ["111","001","111","100","111"],
    "3": ["111","001","111","001","111"],
    "4": ["101","101","111","001","001"],
    "5": ["111","100","111","001","111"],
    "6": ["111","100","111","101","111"],
    "7": ["111","001","010","010","010"],
    "8": ["111","101","111","101","111"],
    "9": ["111","101","111","001","111"],
  };

  function drawDigit(x: number, y: number, d: string) {
    ctx.fillStyle = color;
    const pattern = DIGITS[d];
    for (let row = 0; row < 5; row++) {
      const line = pattern[row];
      for (let col = 0; col < 3; col++) {
        if (line[col] == "1") ctx.fillRect(x + col, y + row, 1, 1);
      }
    }
  }

  ctx.clearRect(0, 0, 16, 16);
  // center in 16×16; each digit is 3×5, add 1px spacing between two digits
  const digits = String(value).split("");
  const totalWidth = digits.length == 1 ? 3 : 3 + 1 + 3;
  const startX = Math.floor((16 - totalWidth) / 2);
  const startY = Math.floor((16 - 5) / 2);
  drawDigit(startX, startY, digits[0]);
  if (digits[1]) drawDigit(startX + 4, startY, digits[1]);
}
