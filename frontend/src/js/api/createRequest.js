// Утилита для создания HTTP-запросов

const createRequest = async (options) => {
    const { method = 'GET', url, data, headers = {} } = options;

    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (data) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      // return await response.text();
      return await response.json();
    } catch (error) {
      console.error('Request failed:', error.message);
      throw error;
    }
  };

  export default createRequest;
