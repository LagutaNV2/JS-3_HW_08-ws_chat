// Основной класс чата
import ChatAPI from './api/ChatAPI';

export default class Chat {
  constructor(container) {
    this.container = container;
    this.api = new ChatAPI();
    this.websocket = null;
    this.username = null;
    this.isChatReady = false; // Флаг готовности интерфейса
    this.pendingMessages = []; // Очередь для временного хранения сообщений

    this.init(); // Инициализируем приложение
  }

  init() {
    this.bindToDOM();

    // Проверяем, есть ли сохраненный пользователь (sessionStorage)
    const savedUserId = sessionStorage.getItem('currentUserId');
    if (savedUserId) {
      this.api.checkUser(savedUserId)
        .then((response) => {
          if (response.status === 'ok') {
            this.username = response.user.name;
            this.api.user = response.user;
            this.subscribeOnEvents();
          } else {
            this.registerEvents();
          }
        })
        .catch((error) => {
          console.error('Ошибка при проверке пользователя:', error.message);
          this.registerEvents();
        });
    } else {
      this.registerEvents();
    }
  }

  bindToDOM() {
    this.modal = document.createElement('div');
    this.modal.classList.add('modal__form', 'active');

    this.modal.innerHTML = `
      <div class="modal__background"></div>
      <div class="modal__content">
        <div class="modal__header">Выберите псевдоним</div>
        <div class="modal__body">
          <form class="form">
            <div class="form__group">
              <label class="form__label" for="username">Никнейм</label>
              <input class="form__input" id="username" type="text" placeholder="Введите никнейм" />
              <div class="form__hint" id="error-message"></div>
            </div>
            <div class="modal__footer">
              <button class="modal__ok" type="submit">Продолжить</button>
            </div>
          </form>
        </div>
      </div>
    `;

    this.container.appendChild(this.modal);
  }

  registerEvents() {
    const form = this.modal.querySelector('.form');
    const input = this.modal.querySelector('#username');
    const errorMessage = this.modal.querySelector('#error-message');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = input.value.trim();

      if (!username || username.length > 20) {
        errorMessage.textContent = 'Никнейм должен быть от 1 до 20 символов';
        return;
      }

      try {
        console.log('Отправляем запрос на создание пользователя:', { name: username });
        const response = await this.api.create({ name: username });
        console.log('Получен ответ от сервера:', response);

        if (response.status === 'ok') {
          this.username = response.user.name;
          this.api.user = response.user; // Сохраняем данные пользователя

          // Сохраняем ID пользователя в sessionStorage
          sessionStorage.setItem('currentUserId', response.user.id);

          this.modal.classList.remove('active');
          console.log('Пользователь успешно создан:', response.user);
          this.subscribeOnEvents(); // Переходим к следующему этапу (WebSocket)
        } else {
          errorMessage.textContent = 'Этот никнейм уже занят';
        }
      } catch (error) {
        console.error('Ошибка при создании пользователя:', error.message);
        errorMessage.textContent = 'Произошла ошибка. Попробуйте снова.';
      }
    });
  }

  subscribeOnEvents() {
    console.log('Устанавливаем WebSocket-соединение...');
    // this.websocket = new WebSocket('ws://localhost:3000');
    this.websocket = new WebSocket('wss://js-3-hw-08-ws-chat.onrender.com');

    this.websocket.onopen = () => {
      console.log('WebSocket connection established');
      if (this.username && this.api.user?.id) {
        console.log('Отправляем сообщение auth:', { type: 'auth', userId: this.api.user.id });
        this.websocket.send(
          JSON.stringify({ type: 'auth', userId: this.api.user.id })
        );
        this.renderChatInterface(); // Отображаем интерфейс чата
      }
    };

    this.websocket.onmessage = (event) => {
      console.log('Получено сообщение через WebSocket:', event.data);
      const message = JSON.parse(event.data);

      if (this.isChatReady) {
        if (message.type === 'message') {
          this.renderMessage(message);
        } else if (message.type === 'updateUsers') {
          this.updateUserList(message.users);
        }
      } else {
        console.log('Интерфейс чата еще не готов. Добавляем сообщение в очередь.');
        this.pendingMessages.push(message); // Сохраняем сообщение в очереди
      }
    };

    this.websocket.onclose = () => {
      console.log('WebSocket-соединение закрыто');
    };

    this.websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  renderChatInterface() {
    this.container.innerHTML = `
      <div class="chat">
         <!-- Левая панель: список пользователей -->
        <div class="chat__sidebar">
          <h3>Активные пользователи</h3>
          <div class="chat__userlist"></div>
        </div>
        <!-- Правая панель: чат -->
        <div class="chat__main">
          <div class="chat__messages-container"></div>
          <form class="chat__input-form">
            <input type="text" class="chat__input" placeholder="Введите сообщение..." />
            <button type="submit" class="chat__send">Отправить</button>
          </form>
        </div>
      </div>
    `;
    this.isChatReady = true; // Флаг готовности интерфейса
    this.processPendingMessages(); // Обрабатываем накопленные сообщения

    // Обработчик отправки сообщений
    const chatForm = document.querySelector('.chat__input-form');
    const chatInput = document.querySelector('.chat__input');

    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();

      if (!text) {
        return;
      }

      // Отправляем сообщение через WebSocket
      this.websocket.send(JSON.stringify({
        type: 'send',
        text,
        user: this.api.user,
      }));

      // Очищаем поле ввода
      chatInput.value = '';
    });
  }

  processPendingMessages() {
    if (!this.isChatReady) return;

    while (this.pendingMessages.length > 0) {
      const message = this.pendingMessages.shift();
      if (message.type === 'message') {
        this.renderMessage(message);
      } else if (message.type === 'updateUsers') {
        this.updateUserList(message.users);
      }
    }
  }

  updateUserList(users) {
    const userListContainer = document.querySelector('.chat__userlist');
    if (!userListContainer) {
      console.error('Элемент .chat__userlist не найден');
      return;
    }

    console.log('Обновляем список пользователей:', users);
    userListContainer.innerHTML = '';

    users.forEach((user) => {
      const isCurrentUser = user.name === this.username;

      const userHTML = `
        <div class="chat__user ${isCurrentUser ? 'yourself' : ''}">
          <div class="circle"></div>
          <span>${isCurrentUser ? 'You' : user.name}</span>
        </div>
      `;
      userListContainer.insertAdjacentHTML('beforeend', userHTML);
    });
  }

  renderMessage(message) {
    const messagesContainer = document.querySelector('.chat__messages-container');
    if (!messagesContainer) {
      console.error('Элемент .chat__messages-container не найден');
      return;
    }

    console.log('Отображаем сообщение:', message);
    const isCurrentUser = message.user.name === this.username;

    // Форматируем дату и время
    const timestamp = new Date(message.timestamp);
    const hours = String(timestamp.getHours()).padStart(2, '0');
    const minutes = String(timestamp.getMinutes()).padStart(2, '0');
    const day = String(timestamp.getDate()).padStart(2, '0');
    const month = String(timestamp.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
    const year = timestamp.getFullYear();
    const formattedDate = `${hours}:${minutes} ${day}.${month}.${year}`;


    const messageHTML = `
      <div class="message__container${isCurrentUser ? '-yourself' : '-interlocutor'}">
        <div class="message__header ${isCurrentUser ? 'yourself' : ''}">
          ${isCurrentUser ? 'You' : message.user.name}, ${formattedDate}
        </div>
        <div class="message__text">${message.text}</div>
      </div>
    `;

    messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }
}

// Удаляем currentUserId при выходе из чата
window.addEventListener('beforeunload', () => {
  sessionStorage.removeItem('currentUserId');
});
