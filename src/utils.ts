export async function delay(time: number) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}
//Put your botToken here.
export const botToken = "";
