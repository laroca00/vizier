/** "Kai'Sa", "kaisa" and "KAİSA" all match each other. */
export function fold(text: string) {
  return text
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/ı/g, "i")
    .replace(/[^\p{L}\p{N}]/gu, "");
}
