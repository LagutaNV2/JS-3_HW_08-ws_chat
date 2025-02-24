// класс предоставляет базовые методы для работы с API (CRUD-операции).
// Не используем их все в данном случае; оставим для будущего расширения.
export default class Entity {
  constructor(apiUrl) {
    this.apiUrl = apiUrl || '/api';
  }
  list() {}

  get() {}

  create() {}

  update() {}

  delete() {}
}
