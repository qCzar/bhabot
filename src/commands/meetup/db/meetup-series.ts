import { FilterQuery } from "mongodb";
import { getCollection as getMongoCollection } from "../../../deprecating/legacy_instance";
import type { Meetup } from "./meetups";

export type WeeklyRecurrence = {
   frequency: "weekly";
   interval: number;
   weekdays: number[];
   endDate: string;
   timezone: string;
};

export type MeetupSeries = {
   id: string;
   guildID: string;
   organizerID: string;
   sourceChannelID: string;
   createdAt: string;
   firstOccurrenceAt: string;
   title: string;
   description: string;
   links: Meetup["links"];
   category: string;
   location?: Meetup["location"];
   maxRsvp?: number;
   rsvpDeadlineOffsetMinutes?: number;
   duration?: number;
   subscription?: string;
   recurrence: WeeklyRecurrence;
   state:
      | { type: "Active" }
      | { type: "Cancelled"; reason: string; timestamp: string };
};

type Schema = MeetupSeries & { __version: 1 };
const getCollection = () => getMongoCollection<Schema> ("meetup-series");
const stripVersion = ({ __version, ...series }: Schema): MeetupSeries => series;
const withVersion = (series: MeetupSeries): Schema => ({ __version: 1, ...series });

export async function insert(series: MeetupSeries): Promise<MeetupSeries> {
   const collection = await getCollection ();
   await collection.createIndex ({ id: 1 }, { unique: true, name: "unique_series_id" });
   await collection.insertOne (withVersion (series));
   return series;
}

export async function update(series: MeetupSeries): Promise<MeetupSeries> {
   const collection = await getCollection ();
   await collection.replaceOne ({ id: series.id }, withVersion (series));
   return series;
}

export async function find(q: FilterQuery<Schema> = {}): Promise<MeetupSeries[]> {
   const collection = await getCollection ();
   return collection.find (q, { projection: { _id: 0 } }).toArray ()
      .then (items => items.map (stripVersion));
}

export async function findOne(q: FilterQuery<Schema> = {}): Promise<MeetupSeries | null> {
   const collection = await getCollection ();
   const result = await collection.findOne (q, { projection: { _id: 0 } });
   return result ? stripVersion (result) : null;
}
