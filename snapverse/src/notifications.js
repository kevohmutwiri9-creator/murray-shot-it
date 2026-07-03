import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  updateDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getDbService } from "./firebase-config.js";
import { getCurrentUser } from "./auth.js";

function actorLabel(actorEmail) {
  if (!actorEmail) return "Someone";
  return actorEmail.split("@")[0];
}

export async function createNotificationForLike(firebaseApp, { postId, actorUid, authorUid, actorEmail }) {
  const db = getDbService(firebaseApp);
  if (!authorUid || authorUid === actorUid) return;

  await addDoc(collection(db, "notifications"), {
    toUid: authorUid,
    type: "like",
    actorUid,
    actorEmail: actorEmail || null,
    postId,
    message: `${actorLabel(actorEmail)} liked your post`,
    createdAt: serverTimestamp(),
    read: false,
  });
}

export async function createNotificationForComment(firebaseApp, { postId, actorUid, authorUid, actorEmail }) {
  const db = getDbService(firebaseApp);
  if (!authorUid || authorUid === actorUid) return;

  await addDoc(collection(db, "notifications"), {
    toUid: authorUid,
    type: "comment",
    actorUid,
    actorEmail: actorEmail || null,
    postId,
    message: `${actorLabel(actorEmail)} commented on your post`,
    createdAt: serverTimestamp(),
    read: false,
  });
}

export async function createNotificationForReaction(firebaseApp, { postId, actorUid, authorUid, actorEmail, reactionId }) {
  const db = getDbService(firebaseApp);
  if (!authorUid || authorUid === actorUid) return;
  const labels = { like: "liked", love: "loved", haha: "laughed at", wow: "reacted wow to", sad: "reacted sad to", angry: "reacted angry to" };
  const verb = labels[reactionId] || "reacted to";

  await addDoc(collection(db, "notifications"), {
    toUid: authorUid,
    type: "reaction",
    actorUid,
    actorEmail: actorEmail || null,
    postId,
    message: `${actorLabel(actorEmail)} ${verb} your post`,
    createdAt: serverTimestamp(),
    read: false,
  });
}

export async function createNotificationForFollow(firebaseApp, { toUid, actorUid, actorEmail }) {
  const db = getDbService(firebaseApp);
  if (!toUid || toUid === actorUid) return;

  await addDoc(collection(db, "notifications"), {
    toUid,
    type: "follow",
    actorUid,
    actorEmail: actorEmail || null,
    message: `${actorLabel(actorEmail)} started following you`,
    createdAt: serverTimestamp(),
    read: false,
  });
}

export async function createNotificationForMessage(firebaseApp, { toUid, actorUid, actorEmail, conversationId }) {
  const db = getDbService(firebaseApp);
  if (!toUid || toUid === actorUid) return;

  await addDoc(collection(db, "notifications"), {
    toUid,
    type: "message",
    actorUid,
    actorEmail: actorEmail || null,
    conversationId,
    message: `${actorLabel(actorEmail)} sent you a message`,
    createdAt: serverTimestamp(),
    read: false,
  });
}

export async function createNotificationForMention(firebaseApp, { toUid, actorUid, actorEmail, postId, handle }) {
  const db = getDbService(firebaseApp);
  if (!toUid || toUid === actorUid) return;

  await addDoc(collection(db, "notifications"), {
    toUid,
    type: "mention",
    actorUid,
    actorEmail: actorEmail || null,
    postId,
    message: `${actorLabel(actorEmail)} mentioned you (@${handle})`,
    createdAt: serverTimestamp(),
    read: false,
  });
}

export async function createNotificationForShare(firebaseApp, { postId, actorUid, authorUid, actorEmail }) {
  const db = getDbService(firebaseApp);
  if (!authorUid || authorUid === actorUid) return;

  await addDoc(collection(db, "notifications"), {
    toUid: authorUid,
    type: "share",
    actorUid,
    actorEmail: actorEmail || null,
    postId,
    message: `${actorLabel(actorEmail)} shared your post`,
    createdAt: serverTimestamp(),
    read: false,
  });
}

export function startNotifications(firebaseApp, { listEl, badgeEl, panelEl, btnEl }) {
  const user = getCurrentUser();
  if (!user) return;

  const db = getDbService(firebaseApp);
  const notificationsCol = collection(db, "notifications");
  const q = query(
    notificationsCol,
    where("toUid", "==", user.uid),
    orderBy("createdAt", "desc"),
    limit(30)
  );

  let panelOpen = false;
  let lastNotificationCount = 0;

  // Request notification permission
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  btnEl?.addEventListener("click", (e) => {
    e.stopPropagation();
    panelOpen = !panelOpen;
    panelEl?.classList.toggle("hidden", !panelOpen);
  });

  document.addEventListener("click", (e) => {
    if (!btnEl?.contains(e.target) && !panelEl?.contains(e.target)) {
      panelOpen = false;
      panelEl?.classList.add("hidden");
    }
  });

  onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Filter out message notifications since they're tracked separately
      const nonMessageNotifications = notifications.filter((n) => n.type !== "message");
      const unread = nonMessageNotifications.filter((n) => !n.read).length;

      // Show desktop notification for new notifications
      if (unread > lastNotificationCount && "Notification" in window && Notification.permission === "granted") {
        const newNotifications = nonMessageNotifications.slice(0, unread - lastNotificationCount);
        newNotifications.forEach((notif) => {
          new Notification("SnapVerse", {
            body: notif.message || "New notification",
            icon: "/murray.png",
            badge: "/murray.png",
          });
        });
      }
      lastNotificationCount = unread;

      if (badgeEl) {
        badgeEl.textContent = unread > 99 ? "99+" : String(unread);
        badgeEl.classList.toggle("hidden", unread === 0);
      }

      if (!listEl) return;
      listEl.innerHTML = "";

      // Add "Mark all as read" button if there are unread notifications
      if (unread > 0) {
        const markAllBtn = document.createElement("button");
        markAllBtn.type = "button";
        markAllBtn.className = "w-full text-left p-3 text-sm text-accent font-medium hover:bg-accent/5 transition border-b border-gray-100 dark:border-gray-700";
        markAllBtn.textContent = "Mark all as read";
        markAllBtn.addEventListener("click", async () => {
          const unreadNotifs = nonMessageNotifications.filter((n) => !n.read);
          await Promise.all(unreadNotifs.map((n) => updateDoc(doc(db, "notifications", n.id), { read: true })));
        });
        listEl.appendChild(markAllBtn);
      }

      if (nonMessageNotifications.length === 0) {
        listEl.innerHTML =
          '<div class="p-4 text-center text-gray-500 dark:text-gray-400">No notifications yet</div>';
        return;
      }

      nonMessageNotifications.forEach((notif) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `w-full text-left p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition ${notif.read ? "opacity-70" : "bg-accent/5"}`;

        let icon = "•";
        let color = "text-gray-500";
        if (notif.type === "like") {
          icon = "♥";
          color = "text-rose-500";
        } else if (notif.type === "comment") {
          icon = "✎";
          color = "text-blue-500";
        } else if (notif.type === "share" || notif.type === "repost") {
          icon = "↗";
          color = "text-green-500";
        } else if (notif.type === "reaction") {
          icon = "👍";
          color = "text-rose-500";
        } else if (notif.type === "follow") {
          icon = "👤";
          color = "text-purple-500";
        } else if (notif.type === "message") {
          icon = "💬";
          color = "text-blue-500";
        } else if (notif.type === "mention") {
          icon = "@";
          color = "text-accent";
        }

        const timeStr = notif.createdAt?.toDate?.()
          ? notif.createdAt.toDate().toLocaleString()
          : "Just now";

        item.innerHTML = `
          <div class="flex items-start gap-3">
            <span class="text-lg ${color}">${icon}</span>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-gray-900 dark:text-white">${notif.message || "New notification"}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${timeStr}</p>
            </div>
          </div>
        `;

        item.addEventListener("click", async () => {
          if (!notif.read) {
            await updateDoc(doc(db, "notifications", notif.id), { read: true });
          }
          panelOpen = false;
          panelEl?.classList.add("hidden");
          if (notif.postId) {
            window.location.href = `/index.html?post=${notif.postId}`;
          } else if (notif.type === "follow" && notif.actorUid) {
            window.location.href = `/snapverse/profile.html?uid=${notif.actorUid}`;
          } else if (notif.type === "message" && notif.actorUid) {
            window.location.href = `/snapverse/messages.html?uid=${notif.actorUid}`;
          }
        });

        listEl.appendChild(item);
      });
    },
    (error) => {
      console.error("Could not load notifications:", error);
      if (listEl) {
        listEl.innerHTML =
          `<div class="p-4 text-center text-rose-500 text-sm">Could not load notifications. ${error?.message ? error.message : 'Check Firestore permissions and indexes.'}</div>`;
      }
    }
  );
}

export function startMessageNotifications(firebaseApp, { badgeEl, mobileBadgeEl }) {
  const user = getCurrentUser();
  if (!user) return;

  const db = getDbService(firebaseApp);
  const notificationsCol = collection(db, "notifications");
  const q = query(
    notificationsCol,
    where("toUid", "==", user.uid),
    where("type", "==", "message"),
    orderBy("createdAt", "desc"),
    limit(50)
  );

  let lastMessageCount = 0;

  // Request notification permission
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }

  onSnapshot(
    q,
    (snapshot) => {
      const messageNotifications = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const unreadMessages = messageNotifications.filter((n) => !n.read).length;

      // Show desktop notification for new messages
      if (unreadMessages > lastMessageCount && "Notification" in window && Notification.permission === "granted") {
        const newMessages = messageNotifications.slice(0, unreadMessages - lastMessageCount);
        newMessages.forEach((notif) => {
          new Notification("New Message - SnapVerse", {
            body: notif.message || "You have a new message",
            icon: "/murray.png",
            badge: "/murray.png",
          });
        });
      }
      lastMessageCount = unreadMessages;

      if (badgeEl) {
        badgeEl.textContent = unreadMessages > 99 ? "99+" : String(unreadMessages);
        badgeEl.classList.toggle("hidden", unreadMessages === 0);
      }

      if (mobileBadgeEl) {
        mobileBadgeEl.textContent = unreadMessages > 99 ? "99+" : String(unreadMessages);
        mobileBadgeEl.classList.toggle("hidden", unreadMessages === 0);
      }
    },
    (error) => {
      console.error("Could not load message notifications:", error);
      if (badgeEl) {
        badgeEl.classList.add("hidden");
      }
      if (mobileBadgeEl) {
        mobileBadgeEl.classList.add("hidden");
      }
    }
  );
}

