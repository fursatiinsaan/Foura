export const createWebSocketConnection = (url, onMessage, onStatusChange) => {
  let ws = new WebSocket(url);
  ws.onopen = () => onStatusChange('connected');
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = () => onStatusChange('disconnected');
  return ws;
};
