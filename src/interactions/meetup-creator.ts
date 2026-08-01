const withoutTrailingSlash = (url: string): string => url.replace (/\/+$/, "");

export const meetupCreatorUrl = (formUrl: string, guildId?: string | null): string => {
   const url = new URL (`${withoutTrailingSlash (formUrl)}/`);
   if (guildId) url.searchParams.set ("server", guildId);
   return url.toString ();
};

export const meetupEditUrl = (formUrl: string, meetupId: string, guildId?: string | null): string =>
   `${meetupCreatorUrl (formUrl, guildId)}#${encodeURIComponent (meetupId)}`;

export const meetupEditMessage = (formUrl: string, meetupId: string, guildId?: string | null): string =>
   [
      `✏️ [Open this meetup in the editor](${meetupEditUrl (formUrl, meetupId, guildId)})`,
      "Make your changes, then paste the generated options into `/bored meetup edit options:` in this thread."
   ].join ("\n");

export const meetupCalendarUrl = (apiUrl: string, meetupId: string): string =>
   `${withoutTrailingSlash (apiUrl)}/meetup/${encodeURIComponent (meetupId)}/gcal`;

export const meetupCreatorMessage = (formUrl: string, guildId?: string | null): string =>
   [
      `🗓️ [Open the meetup creator](${meetupCreatorUrl (formUrl, guildId)})`,
      "Fill out the form, then paste its generated options into `/bored meetup create options:`."
   ].join ("\n");
