import { useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';

/**
 * @param {string} hubUrl
 * @param {(payload: unknown) => void} onNotificationReceived
 * @param {string | null | undefined} accessToken — JWT (without "Bearer " prefix)
 * @param {boolean} enabled
 */
const useSignalR = (hubUrl, onNotificationReceived, accessToken, enabled) => {
  const callbackRef = useRef(onNotificationReceived);
  const tokenRef = useRef(accessToken);

  useEffect(() => {
    callbackRef.current = onNotificationReceived;
  }, [onNotificationReceived]);

  useEffect(() => {
    tokenRef.current = accessToken;
  }, [accessToken]);

  useEffect(() => {
    if (!enabled || !hubUrl) {
      return undefined;
    }

    const token = (accessToken || '').trim();
    if (!token) {
      return undefined;
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => (tokenRef.current || '').trim(),
        skipNegotiation: true,
        transport: signalR.HttpTransportType.WebSockets
      })
      .withAutomaticReconnect()
      .build();

    connection.on('ReceiveNotification', (notification) => {
      callbackRef.current?.(notification);
    });

    let isStopped = false;

    connection
      .start()
      .then(() => {
        if (!isStopped) console.log('SignalR connected');
      })
      .catch((e) => {
        if (!isStopped) console.error('SignalR connection error:', e);
      });

    return () => {
      isStopped = true;
      if (connection.state === signalR.HubConnectionState.Connected || connection.state === signalR.HubConnectionState.Connecting) {
        connection.stop().catch(() => {});
      }
    };
  }, [hubUrl, enabled, accessToken]);
};

export default useSignalR;
