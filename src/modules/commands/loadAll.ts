import { CustomLogger } from "../../../src/logger/log";
import { IPangolinOnload, IPangolinRun } from "src/types/type.pangolin-handle";
export default class LoadAllCommand {
  static config = {
    category: "ADMIN",
    name: "loadAll",
    version: "1.0.0",
    author: "Lợi",
  };

  constructor(private client) {}

  async onload({
    api,
    UserData,
    ThreadData,
    UserInThreadData,
    pangolin,
  }: IPangolinOnload) {
    const Log = new CustomLogger();
    try {
      const threadsData = await ThreadData.getAll();
      const threads = threadsData.map((item) => item.dataValues.tid);
      let usersData = await UserData.getAll();
      let users = usersData.map((item) => item.dataValues.uid);
      const userInThreads = (await UserInThreadData.getAll()).map(
        (item) => item.dataValues.uniqueId,
      );

      const allTags = [["INBOX"], ["OTHER"], ["PENDING"]];
      let allTasksCompleted = 0;

      const onFinish = () => {
        if (++allTasksCompleted === allTags.length) {
          const currentTime = new Date().toLocaleString();
          if (pangolin.noti_loaded_data) {
            pangolin.admins.forEach((id) => {
              api.sendMessage(
                `[DONE] All groups and users have been loaded! (Time: ${currentTime})`,
                id,
              );
            });
          }
          return Log.rainbow(
            "[DONE] All groups and users have been loaded! (Time:",
            currentTime,
            ")",
          );
        }
      };

      allTags.forEach((groupTags) => {
        const [limit, timestamp, tags, callback] = [
          10,
          null,
          groupTags,
          async function (err, list) {
            if (err) {
              console.error("Error fetching threads:", err);
            } else {
              const listBox = list.filter((item) => item.isGroup == true);
              if (listBox.length > 0) {
                for (const box of listBox) {
                  const usersFromListBox = box.participants;
                  for (const item of usersFromListBox) {
                    if (!users.includes(item.userID)) {
                      try {
                        const nowDataUser = await UserData.getAll();
                        if (
                          !nowDataUser.some((user) => user.uid == item.userID)
                        ) {
                          await UserData.set(item.userID, item.name);
                        }
                      } catch (error) {
                        console.error("Error creating user:", error);
                      }
                    }
                    if (!userInThreads.includes(`${item.userID}${box.tid}`)) {
                      await UserInThreadData.set(
                        item.userID,
                        item.name,
                        box.threadID,
                      );
                    }
                  }
                }
              }

              await listBox.forEach(async (item) => {
                if (!threads.includes(item.threadID)) {
                  await ThreadData.set(
                    item.threadID,
                    item.name,
                    item.emoji,
                    item.imageSrc,
                    item.color,
                  );
                }
              });

              const listUser = list.filter((item) => item.isGroup == false);
              for (const item of listUser) {
                if (!users.includes(item.userID)) {
                  try {
                    const nowDataUser = await UserData.getAll();
                    if (!nowDataUser.some((user) => user.uid == item.userID)) {
                      await UserData.set(item.userID, item.name);
                    }
                  } catch (error) {
                    console.error("Error creating user:", error);
                  }
                }
              }
            }
            onFinish();
          },
        ];
        api.getThreadList(limit, timestamp, tags, callback);
      });
    } catch (error) {
      pangolin.admins.forEach((id) => {
        api.sendMessage("Lỗi khi thực thi mã:" + error, id);
      });
    }
  }
}
