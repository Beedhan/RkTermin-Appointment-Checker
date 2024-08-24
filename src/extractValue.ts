import Lens from "chrome-lens-ocr";
import path from "path";

export default async function extractValue() {
  const lens = new Lens({
    headers: {
      "Accept-Language": "en-US,en;q=0.5",
    },
  });
  try {
    const data = await lens.scanByFile(path.join(__dirname, "image.jpg"));
    console.log(data);
    return data.segments[0].text;
  } catch (error: any) {
    console.log(error.message, "lens error");
    return null;
  }
}
