import util from "node:util";

if (typeof util.styleText === "function") {
  const originalStyleText = util.styleText;
  util.styleText = function (format, text) {
    try {
      if (Array.isArray(format)) {
        return originalStyleText(format[0] || "reset", text);
      }
      return originalStyleText(format, text);
    } catch (e) {
      return text;
    }
  };
}
