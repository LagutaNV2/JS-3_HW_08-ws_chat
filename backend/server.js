import { randomUUID } from "node:crypto";
import http from "node:http";
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import pino from "pino";
import pinoPretty from "pino-pretty";
import WebSocket, { WebSocketServer } from "ws";

const app = express();
const logger = pino(pinoPretty());

// Middleware
app.use(cors());
app.use(
  bodyParser.json({
    type(req) {
      return true;
    },
  })
);
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json");
  next();
});

// Состояние пользователей
const userState = [];

// Маршрут для проверки пользователя
app.post("/api/check-user", async (request, response) => {
  const { id } = request.body;

  if (!id) {
    return response.status(400).send(
      JSON.stringify({ status: "error", message: "Missing 'id' field" })
    );
  }

  const user = userState.find((u) => u.id === id);

  if (user) {
    response.send(JSON.stringify({ status: "ok", user }));
  } else {
    response.status(404).send(
      JSON.stringify({ status: "error", message: "User not found" })
    );
  }
});

// Маршрут для создания нового пользователя
app.post("/api/new-user", async (request, response) => {
  const { name } = request.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return response.status(400).send(
      JSON.stringify({ status: "error", message: "Invalid or missing 'name' field" })
    );
  }

  const isExist = userState.find((user) => user.name === name);

  if (!isExist) {
    const newUser = {
      id: randomUUID(),
      name: name,
    };
    userState.push(newUser);
    console.log('Ответ сервера:', JSON.stringify({ status: "ok", user: newUser }));
    broadcastUsers(); // Оповещение всех клиентов о новом пользователе
    response.send(JSON.stringify({ status: "ok", user: newUser }));
  } else {
    response.status(409).send(
      JSON.stringify({ status: "error", message: "This name is already taken!" })
    );
  }
});

// Создание HTTP-сервера
const server = http.createServer(app);

// Создание WebSocket-сервера
const wsServer = new WebSocketServer({ server });

// Рассылка обновленного списка пользователей всем клиентам
function broadcastUsers() {
  const message = JSON.stringify({ type: "updateUsers", users: userState });
  Array.from(wsServer.clients).forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      logger.info(`Обновленный список пользователей отправлен клиенту`);
    }
  });
}

// Обработчик WebSocket-соединений
wsServer.on("connection", (ws) => {
  let userId = null; // Идентификатор пользователя

  // Отправка текущего списка пользователей при подключении
  ws.send(JSON.stringify({ type: "updateUsers", users: userState }));
  logger.info(`Отправлен текущий список пользователей новому клиенту`);

  // Обработка входящих сообщений
  ws.on("message", (msg) => {
    let receivedMsg;
    try {
      receivedMsg = JSON.parse(msg);
    } catch (error) {
      logger.error(`Invalid message format: ${msg}`);
      return;
    }

    if (receivedMsg.type === "auth") {
      const user = userState.find((u) => u.id === receivedMsg.userId);
      if (user) {
        userId = user.id;
        logger.info(`Пользователь ${user.name} аутентифицирован`);
      } else {
        ws.close();
        logger.warn(`Попытка аутентификации несуществующего пользователя`);
        return;
      }
    } else if (receivedMsg.type === "send" && userId) {
      const message = {
        type: "message",
        user: userState.find((u) => u.id === userId),
        text: receivedMsg.text,
        timestamp: new Date().toISOString(),
      };

      // Рассылка сообщения всем клиентам
      const messageToSend = JSON.stringify(message);
      Array.from(wsServer.clients).forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(messageToSend);
          logger.info(`Сообщение отправлено клиенту`);
        }
      });
    } else {
      logger.warn(`Неизвестный тип сообщения: ${receivedMsg.type}`);
    }
  });

  // Обработка закрытия соединения
  ws.on("close", () => {
    if (userId) {
      // Удаление пользователя из списка активных
      const idx = userState.findIndex((u) => u.id === userId);
      if (idx !== -1) {
        const disconnectedUser = userState.splice(idx, 1)[0];
        logger.info(`Пользователь ${disconnectedUser.name} отключен`);

        // Рассылка обновленного списка пользователей всем клиентам
        broadcastUsers();
      }
    }
  });

  // Обработка ошибок WebSocket
  ws.on("error", (err) => {
    logger.error(`WebSocket error: ${err.message}`);
  });
});

// Запуск сервера
const port = process.env.PORT || 3000;
const bootstrap = async () => {
  try {
    server.listen(port, () =>
      logger.info(`Сервер запущен на http://localhost:${port}`)
    );
  } catch (error) {
    logger.error(`Ошибка: ${error.message}`);
  }
};

bootstrap();