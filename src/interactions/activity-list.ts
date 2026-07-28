const DEFAULT_MESSAGE_LIMIT = 2000;
const PAGE_SUFFIX_RESERVE = 16;

type Section = {
   emoji: string;
   label: string;
   names: string[];
   emptyMessage: string;
};

const sanitizeName = (name: string) => {
   const sanitized = name
      .replace(/[\r\n]+/g, " ")
      .replace(/`/g, "'")
      .trim();

   return sanitized || "(unnamed activity)";
};

const sortNames = (names: string[]) =>
   names
      .map(sanitizeName)
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));

const renderSection = (
   section: Section,
   rows: string[],
   page?: { current: number; total: number }
) => {
   const pageLabel = page ? ` — ${page.current}/${page.total}` : "";
   const heading = `${section.emoji} **${section.label} (${section.names.length})${pageLabel}**`;

   if (rows.length === 0)
      return `${heading}\n${section.emptyMessage}`;

   const header = "Activity";
   const divider = "--------";

   return `${heading}\n\`\`\`\n${header}\n${divider}\n${rows.join("\n")}\n\`\`\``;
};

const paginateSection = (section: Section, messageLimit: number) => {
   if (section.names.length === 0)
      return [renderSection(section, [])];

   const rows = [...section.names];
   const pages: string[][] = [];
   let currentRows: string[] = [];

   for (const row of rows) {
      const candidate = [...currentRows, row];
      const candidateLength = renderSection(section, candidate).length + PAGE_SUFFIX_RESERVE;

      if (currentRows.length > 0 && candidateLength > messageLimit) {
         pages.push(currentRows);
         currentRows = [row];
      } else {
         currentRows = candidate;
      }
   }

   pages.push(currentRows);

   return pages.map((pageRows, index) =>
      renderSection(
         section,
         pageRows,
         pages.length > 1 ? { current: index + 1, total: pages.length } : undefined
      )
   );
};

const packSections = (sections: string[], messageLimit: number) => {
   const messages: string[] = [];
   let current = "";

   for (const section of sections) {
      const candidate = current ? `${current}\n\n${section}` : section;

      if (current && candidate.length > messageLimit) {
         messages.push(current);
         current = section;
      } else {
         current = candidate;
      }
   }

   if (current)
      messages.push(current);

   return messages;
};

export const formatActivityListMessages = (
   joinedActivityNames: string[],
   availableActivityNames: string[],
   messageLimit = DEFAULT_MESSAGE_LIMIT
) => {
   const joinedNames = sortNames(joinedActivityNames);
   const availableNames = sortNames(availableActivityNames);

   if (joinedNames.length === 0 && availableNames.length === 0)
      return ["There are no activities available."];

   const sections: Section[] = [
      {
         emoji: "✅",
         label: "YOUR ACTIVITIES",
         names: joinedNames,
         emptyMessage: "You haven't joined any activities yet."
      },
      {
         emoji: "➕",
         label: "AVAILABLE TO JOIN",
         names: availableNames,
         emptyMessage: "You've joined every available activity."
      }
   ];

   return packSections(
      sections.flatMap(section => paginateSection(section, messageLimit)),
      messageLimit
   );
};
