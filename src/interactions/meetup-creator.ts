const withoutTrailingSlash = (url: string): string => url.replace (/\/+$/, "");

export const meetupCreatorUrl = (formUrl: string): string =>
   `${withoutTrailingSlash (formUrl)}/`;

export const meetupEditUrl = (formUrl: string, meetupId: string): string =>
   `${meetupCreatorUrl (formUrl)}#${encodeURIComponent (meetupId)}`;

export const meetupEditMessage = (formUrl: string, meetupId: string): string =>
   [
      `✏️ [Open this meetup in the editor](${meetupEditUrl (formUrl, meetupId)})`,
      "Make your changes, then paste the generated options into `/bored meetup edit options:` in this thread."
   ].join ("\n");

export const meetupCalendarUrl = (apiUrl: string, meetupId: string): string =>
   `${withoutTrailingSlash (apiUrl)}/meetup/${encodeURIComponent (meetupId)}/gcal`;

export const meetupCreatorMessage = (formUrl: string): string =>
   [
      `🗓️ [Open the meetup creator](${meetupCreatorUrl (formUrl)})`,
      "Fill out the form, then paste its generated options into `/bored meetup create options:`."
   ].join ("\n");
