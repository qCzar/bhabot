type ChannelSource<T> = {
   cache: { get: (channelId: string) => T | undefined };
   fetch: (channelId: string) => Promise<T | null>;
};

export async function getCachedOrFetchedChannel<T> (
   channels: ChannelSource<T>,
   channelId: string
): Promise<T | null> {
   const cachedChannel = channels.cache.get (channelId);
   if (cachedChannel) return cachedChannel;

   return channels.fetch (channelId).catch (() => null);
}
