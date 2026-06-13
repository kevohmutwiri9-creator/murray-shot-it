// Push notifications for SnapVerse
import { getMessaging, getToken, onMessage, deleteToken } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

let messaging = null;
let currentToken = null;

export function initializeMessaging(firebaseApp) {
  try {
    messaging = getMessaging(firebaseApp);
    return messaging;
  } catch (error) {
    console.error("Error initializing messaging:", error);
    return null;
  }
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    throw new Error("This browser does not support notifications");
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

export async function getPushToken(firebaseApp, vapidKey) {
  if (!messaging) {
    messaging = initializeMessaging(firebaseApp);
  }

  if (!messaging) {
    throw new Error("Messaging not initialized");
  }

  try {
    const permission = await requestNotificationPermission();
    if (!permission) {
      throw new Error("Notification permission denied");
    }

    currentToken = await getToken(messaging, { vapidKey });
    return currentToken;
  } catch (error) {
    console.error("Error getting push token:", error);
    throw error;
  }
}

export async function removePushToken(firebaseApp) {
  if (!messaging || !currentToken) {
    return;
  }

  try {
    await deleteToken(messaging);
    currentToken = null;
  } catch (error) {
    console.error("Error removing push token:", error);
  }
}

export function onPushMessage(callback) {
  if (!messaging) {
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    callback(payload);
  });
}

export function showLocalNotification(title, body, options = {}) {
  if (!("Notification" in window)) {
    return;
  }

  if (Notification.permission === "granted") {
    const notification = new Notification(title, {
      body,
      icon: options.icon || "/favicon.ico",
      badge: options.badge || "/favicon.ico",
      tag: options.tag,
      data: options.data,
      requireInteraction: options.requireInteraction || false,
      silent: options.silent || false,
    });

    if (options.onClick) {
      notification.onclick = options.onClick;
    }

    if (options.timeout) {
      setTimeout(() => notification.close(), options.timeout);
    }
  }
}

export async function savePushTokenToFirestore(db, uid, token) {
  const { doc, setDoc, serverTimestamp } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  
  const tokenRef = doc(db, "pushTokens", `${uid}_${token}`);
  await setDoc(tokenRef, {
    uid,
    token,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function removePushTokenFromFirestore(db, uid, token) {
  const { doc, deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  
  const tokenRef = doc(db, "pushTokens", `${uid}_${token}`);
  await deleteDoc(tokenRef);
}

export async function getUserPushTokens(db, uid) {
  const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  
  const tokensCol = collection(db, "pushTokens");
  const q = query(tokensCol, where("uid", "==", uid));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => doc.data().token);
}

export function isPushSupported() {
  return "Notification" in window && "serviceWorker" in navigator && "PushManager" in navigator;
}

export function getNotificationPermission() {
  if (!("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export async function enableNotifications(firebaseApp, vapidKey, db, uid) {
  try {
    const token = await getPushToken(firebaseApp, vapidKey);
    await savePushTokenToFirestore(db, uid, token);
    return { success: true, token };
  } catch (error) {
    console.error("Error enabling notifications:", error);
    return { success: false, error: error.message };
  }
}

export async function disableNotifications(db, uid) {
  try {
    if (currentToken) {
      await removePushTokenFromFirestore(db, uid, currentToken);
      await removePushToken();
    }
    return { success: true };
  } catch (error) {
    console.error("Error disabling notifications:", error);
    return { success: false, error: error.message };
  }
}

export function onForegroundMessage(callback) {
  return onPushMessage((payload) => {
    const notification = payload.notification;
    if (notification) {
      showLocalNotification(notification.title || "SnapVerse", notification.body, {
        icon: notification.icon,
        tag: payload.tag,
        data: payload.data,
      });
    }
    callback(payload);
  });
}
