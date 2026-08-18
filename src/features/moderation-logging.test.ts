try {
   const streamWeb = require("stream/web");
   if (!global.ReadableStream && streamWeb.ReadableStream) {
      global.ReadableStream = streamWeb.ReadableStream;
      global.WritableStream = streamWeb.WritableStream;
      global.TransformStream = streamWeb.TransformStream;
   }
} catch {}

if (typeof global.fetch === "undefined") {
   (global as any).fetch = jest.fn();
}

import * as Discord from "discord.js";
import {
   truncate,
   makeThreadTitle,
   parseUserIdFromThread,
   makeBanEmbed,
   makeKickEmbed,
   makeMessageDeleteEmbed,
   makeModNoteEmbed,
   fetchUserAuditHistory
} from "./moderation-logging";

describe("moderation-logging", () => {
   describe("truncate", () => {
      it("should return string as-is if within limit", () => {
         expect(truncate("hello", 10)).toBe("hello");
      });

      it("should truncate string with ellipsis if exceeds limit", () => {
         expect(truncate("hello world", 8)).toBe("hello...");
      });
   });

   describe("makeThreadTitle", () => {
      it("should format title with user id, username, and nickname", () => {
         const user = { id: "123456789012345678", username: "testuser" };
         const member = { nickname: "Tester" } as any;
         expect(makeThreadTitle(user, member)).toBe("123456789012345678 - testuser - Tester");
      });

      it("should use displayName if nickname is missing", () => {
         const user = { id: "123456789012345678", username: "testuser" };
         const member = { displayName: "TesterDisplay" } as any;
         expect(makeThreadTitle(user, member)).toBe("123456789012345678 - testuser - TesterDisplay");
      });

      it("should fallback to 'no nickname' when member is null", () => {
         const user = { id: "123456789012345678", username: "testuser" };
         expect(makeThreadTitle(user, null)).toBe("123456789012345678 - testuser - no nickname");
      });

      it("should cap length at 100 characters", () => {
         const user = { id: "123456789012345678", username: "verylongusername".repeat(5) };
         const title = makeThreadTitle(user, null);
         expect(title.length).toBeLessThanOrEqual(100);
         expect(title.endsWith("...")).toBe(true);
      });
   });

   describe("parseUserIdFromThread", () => {
      it("should extract 18-digit user id from standard thread name", () => {
         const channel = { name: "123456789012345678 - alice - Alice" } as any;
         expect(parseUserIdFromThread(channel)).toBe("123456789012345678");
      });

      it("should extract user id from exact id thread name", () => {
         const channel = { name: "987654321098765432" } as any;
         expect(parseUserIdFromThread(channel)).toBe("987654321098765432");
      });

      it("should return null for non-member thread channels", () => {
         const channel = { name: "general-chat" } as any;
         expect(parseUserIdFromThread(channel)).toBeNull();
      });

      it("should return null if channel is null or has no name", () => {
         expect(parseUserIdFromThread(null)).toBeNull();
         expect(parseUserIdFromThread({} as any)).toBeNull();
      });
   });

   describe("makeBanEmbed", () => {
      it("should format ban embed correctly with executor and reason", () => {
         const user = { id: "111111111111111111", username: "baduser", tag: "baduser#0001" } as Discord.User;
         const executor = { id: "999999999999999999", username: "moduser", tag: "moduser#0001" } as Discord.User;
         const embed = makeBanEmbed(user, executor, "Spamming links", new Date("2026-08-17T12:00:00Z"));

         expect(embed.title).toBe("🔨 Member Banned");
         expect(embed.color).toBe(0xed4245);
         expect(embed.fields).toEqual([
            { name: "User", value: "<@111111111111111111> (111111111111111111)" },
            { name: "Moderator", value: "<@999999999999999999> (moduser#0001)" },
            { name: "Reason", value: "Spamming links" }
         ]);
         expect(embed.timestamp).toBe("2026-08-17T12:00:00.000Z");
      });

      it("should handle null executor and reason gracefully", () => {
         const user = { id: "111111111111111111" } as Discord.User;
         const embed = makeBanEmbed(user, null, null);

         expect(embed.fields?.[1].value).toContain("Unknown");
         expect(embed.fields?.[2].value).toBe("No reason provided");
      });
   });

   describe("makeKickEmbed", () => {
      it("should format kick embed correctly", () => {
         const user = { id: "222222222222222222", username: "kickeduser", tag: "kickeduser#0002" } as Discord.User;
         const executor = { id: "999999999999999999", username: "moduser", tag: "moduser#0001" } as Discord.User;
         const embed = makeKickEmbed(user, executor, "Inappropriate nickname");

         expect(embed.title).toBe("👢 Member Kicked");
         expect(embed.color).toBe(0xe67e22);
         expect(embed.fields?.[0].value).toBe("<@222222222222222222> (222222222222222222)");
         expect(embed.fields?.[1].value).toBe("<@999999999999999999> (moduser#0001)");
         expect(embed.fields?.[2].value).toBe("Inappropriate nickname");
      });
   });

   describe("makeMessageDeleteEmbed", () => {
      it("should format message delete embed with content and attachments", () => {
         const author = { id: "333333333333333333", tag: "author#0003" };
         const executor = { id: "999999999999999999", username: "moduser", tag: "moduser#0001" } as Discord.User;
         const embed = makeMessageDeleteEmbed(
            author,
            executor,
            "444444444444444444",
            "This is a deleted message",
            ["https://cdn.discordapp.com/attachments/test.png"]
         );

         expect(embed.title).toBe("🗑️ Message Deleted by Moderator");
         expect(embed.fields).toHaveLength(5);
         expect(embed.fields?.[0].value).toBe("<@333333333333333333> (333333333333333333)");
         expect(embed.fields?.[1].value).toBe("<@999999999999999999> (moduser#0001)");
         expect(embed.fields?.[2].value).toBe("<#444444444444444444> (444444444444444444)");
         expect(embed.fields?.[3].value).toBe("This is a deleted message");
         expect(embed.fields?.[4].value).toBe("https://cdn.discordapp.com/attachments/test.png");
      });

      it("should note uncached message content", () => {
         const author = { id: "333333333333333333" };
         const executor = { id: "999999999999999999", username: "moduser", tag: "moduser#0001" } as Discord.User;
         const embed = makeMessageDeleteEmbed(author, executor, "444444444444444444", null);

         expect(embed.fields?.[3].value).toBe("*[Message content was not cached]*");
      });
   });

   describe("makeModNoteEmbed", () => {
      it("should format mod note embed correctly", () => {
         const user = { id: "555555555555555555" };
         const moderator = { id: "999999999999999999", tag: "moduser#0001" } as Discord.User;
         const embed = makeModNoteEmbed(user, moderator, "User was warned regarding rule 3.");

         expect(embed.title).toBe("📝 Mod Note Logged");
         expect(embed.color).toBe(0x3498db);
         expect(embed.fields?.[2].value).toBe("User was warned regarding rule 3.");
      });
   });

   describe("fetchUserAuditHistory", () => {
      it("should return empty history message if no entries match user", async () => {
         const mockGuild = {
            fetchAuditLogs: jest.fn().mockResolvedValue({
               entries: new Map()
            })
         } as any;

         const embed = await fetchUserAuditHistory(mockGuild, "123456789012345678");
         expect(embed.title).toContain("Audit Log History");
         expect(embed.description).toContain("No moderation audit log actions found");
         expect(embed.description).toContain("voluntary leave");
      });

      it("should parse matching audit log entries correctly", async () => {
         const entries = new Map<string, any>([
            [
               "1",
               {
                  id: "1",
                  targetId: "123456789012345678",
                  action: Discord.AuditLogEvent.MemberBanAdd,
                  executor: { id: "999", tag: "mod#1" },
                  reason: "Spam rule",
                  createdTimestamp: 1600000000000
               }
            ],
            [
               "2",
               {
                  id: "2",
                  targetId: "123456789012345678",
                  action: Discord.AuditLogEvent.MessageDelete,
                  executor: { id: "999", tag: "mod#1" },
                  extra: { channel: { id: "555" }, count: 2 },
                  reason: null,
                  createdTimestamp: 1600000010000
               }
            ]
         ]);

         const mockGuild = {
            fetchAuditLogs: jest.fn().mockResolvedValue({
               entries
            })
         } as any;

         const embed = await fetchUserAuditHistory(mockGuild, "123456789012345678");
         expect(embed.title).toContain("Audit Log History");
         expect(embed.description).toContain("Banned");
         expect(embed.description).toContain("Message(s) deleted");
      });

      it("should handle error gracefully when audit log fetch fails", async () => {
         const mockGuild = {
            fetchAuditLogs: jest.fn().mockRejectedValue(new Error("Missing Permissions"))
         } as any;

         const embed = await fetchUserAuditHistory(mockGuild, "123456789012345678");
         expect(embed.title).toContain("Failed");
         expect(embed.description).toContain("View Audit Log");
      });
   });

   describe("Event Handlers", () => {
      let mockForum: any;
      let mockThread: any;

      beforeEach(() => {
         mockThread = {
            name: "111111111111111111 - testuser - Tester",
            archived: true,
            setArchived: jest.fn().mockResolvedValue(undefined),
            send: jest.fn().mockResolvedValue(undefined)
         };

         mockForum = {
            type: Discord.ChannelType.GuildForum,
            threads: {
               fetchActive: jest.fn().mockResolvedValue({ threads: [mockThread] }),
               fetchArchived: jest.fn().mockResolvedValue({ threads: [] }),
               create: jest.fn().mockResolvedValue(mockThread)
            }
         };
      });

      describe("handleGuildBanAdd", () => {
         it("should unarchive and post ban embed to existing member thread", async () => {
            const mockBan = {
               guild: {
                  id: "test-guild",
                  channels: {
                     fetch: jest.fn().mockResolvedValue(mockForum)
                  },
                  fetchAuditLogs: jest.fn().mockResolvedValue({
                     entries: new Map([
                        [
                           "ban-entry",
                           {
                              target: { id: "111111111111111111" },
                              executor: { id: "999999", tag: "mod#0001" },
                              reason: "Violating rules",
                              createdTimestamp: Date.now()
                           }
                        ]
                     ])
                  })
               },
               user: {
                  id: "111111111111111111",
                  username: "testuser",
                  tag: "testuser#1234"
               },
               reason: "Violating rules"
            } as any;

            const { handleGuildBanAdd } = require("./moderation-logging");
            await handleGuildBanAdd(mockBan);

            expect(mockThread.setArchived).toHaveBeenCalledWith(false, expect.any(String));
            expect(mockThread.send).toHaveBeenCalledWith(expect.objectContaining({
               embeds: [expect.objectContaining({ title: "🔨 Member Banned" })]
            }));
         });
      });

      describe("handleGuildMemberRemove", () => {
         it("should ignore voluntary leaves (no kick audit log)", async () => {
            const mockMember = {
               guild: {
                  id: "test-guild",
                  channels: {
                     fetch: jest.fn().mockResolvedValue(mockForum)
                  },
                  fetchAuditLogs: jest.fn().mockResolvedValue({
                     entries: new Map() // No kick audit log entries
                  })
               },
               id: "111111111111111111",
               user: {
                  id: "111111111111111111",
                  username: "testuser",
                  tag: "testuser#1234"
               }
            } as any;

            const { handleGuildMemberRemove } = require("./moderation-logging");
            await handleGuildMemberRemove(mockMember);

            expect(mockThread.send).not.toHaveBeenCalled();
         });

         it("should log kick when matching audit log is present", async () => {
            const mockMember = {
               guild: {
                  id: "test-guild",
                  channels: {
                     fetch: jest.fn().mockResolvedValue(mockForum)
                  },
                  fetchAuditLogs: jest.fn().mockResolvedValue({
                     entries: new Map([
                        [
                           "kick-entry",
                           {
                              target: { id: "111111111111111111" },
                              executor: { id: "999999", tag: "mod#0001" },
                              reason: "Spamming",
                              createdTimestamp: Date.now()
                           }
                        ]
                     ])
                  })
               },
               id: "111111111111111111",
               user: {
                  id: "111111111111111111",
                  username: "testuser",
                  tag: "testuser#1234"
               }
            } as any;

            const { handleGuildMemberRemove } = require("./moderation-logging");
            await handleGuildMemberRemove(mockMember);

            expect(mockThread.send).toHaveBeenCalledWith(expect.objectContaining({
               embeds: [expect.objectContaining({ title: "👢 Member Kicked" })]
            }));
         });
      });

      describe("handleMessageDelete", () => {
         it("should ignore self-deletions (no moderator audit log)", async () => {
            const mockMessage = {
               guild: {
                  id: "test-guild",
                  channels: {
                     fetch: jest.fn().mockResolvedValue(mockForum)
                  },
                  fetchAuditLogs: jest.fn().mockResolvedValue({
                     entries: new Map() // No moderator delete audit log
                  })
               },
               channelId: "channel-1",
               id: "msg-1",
               author: { id: "111111111111111111", tag: "testuser#1234" },
               content: "User deleting their own message",
               client: { user: { id: "bot-id" } }
            } as any;

            const { handleMessageDelete } = require("./moderation-logging");
            await handleMessageDelete(mockMessage);

            expect(mockThread.send).not.toHaveBeenCalled();
         });

         it("should log moderator deletions when audit log matches", async () => {
            const mockMessage = {
               guild: {
                  id: "test-guild",
                  channels: {
                     fetch: jest.fn().mockResolvedValue(mockForum)
                  },
                  fetchAuditLogs: jest.fn().mockResolvedValue({
                     entries: new Map([
                        [
                           "del-entry",
                           {
                              target: { id: "111111111111111111" },
                              executor: { id: "999999", tag: "mod#0001" },
                              extra: { channel: { id: "channel-1" } },
                              createdTimestamp: Date.now()
                           }
                        ]
                     ])
                  })
               },
               channelId: "channel-1",
               id: "msg-1",
               author: { id: "111111111111111111", tag: "testuser#1234" },
               content: "Bad message deleted by mod",
               attachments: new Map(),
               client: { user: { id: "bot-id" } }
            } as any;

            const { handleMessageDelete } = require("./moderation-logging");
            await handleMessageDelete(mockMessage);

            expect(mockThread.send).toHaveBeenCalledWith(expect.objectContaining({
               embeds: [expect.objectContaining({ title: "🗑️ Message Deleted by Moderator" })]
            }));
         });
      });
   });
});
