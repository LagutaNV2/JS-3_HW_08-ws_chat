// Класс для работы с API чата
import Entity from './Entity';
import createRequest from './createRequest';

export default class ChatAPI extends Entity {
  constructor() {
    //super('/api');
    // super('http://localhost:3000/api');

    // Заменяем localhost на URL сервера на Render
    super('https://js-3-hw-08-ws-chat.onrender.com/api');
    this.user = null;
  }

  async create(data) {
    const response = await createRequest({
      method: 'POST',
      url: `${this.apiUrl}/new-user`,
      data,
    });
    //return JSON.parse(response);
    return response;
  }

  async checkUser(id) {
    const response = await createRequest({
      method: 'POST',
      url: `${this.apiUrl}/check-user`,
      data: { id },
    });
    return response;
  }
  // Дополнительные методы можно добавить здесь
}
