import { type NodeList } from "subtitle";
import { type TSubItem } from "@src/models/types";
import { type TSub } from "@src/models/types";
import { textToWords } from "./textToWords";
import { cleanWord } from "./cleanWord";

const cleanText = (text: string): string => {
  const tmpDiv = document.createElement("div");
  tmpDiv.innerHTML = text
    .replace(/<\d+:\d+:\d+.\d+><c>/g, "")
    .replace(/<\/c>/g, "")
    .replace(/(\r\n|\n|\r)/gm, " ");
  return tmpDiv.textContent || "";
};

export const convertRawSubs = (rawSubs: NodeList): TSub[] => {
  return rawSubs
    .map((sub, index) => {
      if (sub.type !== "cue") return;
      const words = textToWords(sub.data.text).filter((word) => word);
      const items: TSubItem[] = words.map((word: string) => {
        return {
          text: word,
          cleanedText: cleanWord(word),
          type: "word",
          tag: "span",
        };
      });

      return {
        id: index,
        start: sub.data.start,
        end: sub.data.end,
        text: sub.data.text,
        cleanedText: cleanText(sub.data.text),
        items: items,
      };
    })
    .filter((x) => !!x);
};

// 2. Helper function to re-segment text using Intl.Segmenter
export const splitUsingIntl = (subs: TSub[], language: string): TSub[] => {
  // If language is auto/unknown, or browser doesn't support Segmenter, return naive split
  if (language === "auto" || !language || typeof Intl === "undefined" || !Intl.Segmenter) {
    return subs;
  }

  try {
    const segmenter = new Intl.Segmenter(language, { granularity: "word" });

    return subs.map((sub) => {
      // We take the full cleaned text of the subtitle line and re-segment it
      const segments = Array.from(segmenter.segment(sub.cleanedText));

      const newItems: TSubItem[] = [];

      for (const seg of segments) {
        // isWordLike is true for words, false for spaces/punctuation
        if (seg.isWordLike) {
          newItems.push({
            text: seg.segment,
            cleanedText: cleanWord(seg.segment), // Ensure we clean special chars if any
            type: "word",
            tag: "span", // We lose specific formatting tags (b/i/u) here, but gain correct word boundaries
          });
        }
        // Optional: If you want to keep punctuation as items, add else if logic here
      }

      // If segmenter returned nothing (empty line), fallback to original items
      if (newItems.length === 0 && sub.items.length > 0) {
        return sub;
      }

      return {
        ...sub,
        items: newItems,
      };
    });
  } catch (e) {
    console.error("Intl.Segmenter failed, falling back to original", e);
    return subs;
  }
};
