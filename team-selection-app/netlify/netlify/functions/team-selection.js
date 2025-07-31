// netlify/functions/team-selection.js
// Netlify Functions для обробки вибору команд

const MAX_TEAM_SIZE = 30;
const TEAMS = ['team1', 'team2', 'team3'];

// Простий in-memory store (для production використовуйте справжню БД)
let teamData = {
  selections: [],
  counters: { team1: 0, team2: 0, team3: 0 }
};

// Функція для отримання IP користувача
function getUserId(event) {
  const ip = event.headers['x-forwarded-for'] || 
           event.headers['x-real-ip'] || 
           'unknown';
  const userAgent = event.headers['user-agent'] || '';
  // Створюємо унікальний ID на основі IP + User Agent
  return `${ip}_${userAgent.slice(0, 50)}`.replace(/[^a-zA-Z0-9_]/g, '_');
}

// Перевірка чи користувач вже вибрав команду
function hasUserSelected(userId) {
  return teamData.selections.some(selection => 
    selection.userId === userId && selection.status === 'selected'
  );
}

// Додавання користувача до команди
function addUserToTeam(teamId, userId) {
  teamData.selections.push({
    teamId,
    userId,
    timestamp: Date.now(),
    status: 'selected'
  });
  
  teamData.counters[teamId]++;
}

// Головна функція обробки запитів
exports.handler = async (event, context) => {
  // CORS заголовки
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400'
  };

  // Обробка preflight запитів
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const url = new URL(event.rawUrl);
    const action = url.searchParams.get('action');

    // GET запити - отримання даних команд
    if (event.httpMethod === 'GET' && action === 'getTeamCounts') {
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        body: JSON.stringify({
          success: true,
          teams: teamData.counters,
          timestamp: Date.now()
        })
      };
    }

    // POST запити - вибір команди
    if (event.httpMethod === 'POST') {
      const data = JSON.parse(event.body);
      
      if (data.action === 'selectTeam') {
        const teamId = data.team;
        const userId = getUserId(event);

        // Валідація команди
        if (!TEAMS.includes(teamId)) {
          return {
            statusCode: 400,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              message: 'Невірна команда'
            })
          };
        }

        // Перевірка чи користувач вже вибрав команду
        if (hasUserSelected(userId)) {
          return {
            statusCode: 400,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: false,
              message: 'Ви вже обрали команду'
            })
          };
        }

        // Перевірка ліміту команди
        if (teamData.counters[teamId] >= MAX_TEAM_SIZE) {
          return {
            statusCode: 200,
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              success: true,
              teamFull: true,
              teams: teamData.counters,
              message: 'Команда заповнена'
            })
          };
        }

        // Додаємо користувача до команди
        addUserToTeam(teamId, userId);

        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: true,
            teamFull: false,
            teams: teamData.counters,
            message: `Успішно приєдналися до ${teamId}`
          })
        };
      }
    }

    // GET запит для статистики (додатково)
    if (event.httpMethod === 'GET' && action === 'getStats') {
      const stats = {
        totalSelections: teamData.selections.length,
        teamBreakdown: teamData.counters,
        lastActivity: Math.max(...teamData.selections.map(s => s.timestamp), 0)
      };

      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: true,
          stats
        })
      };
    }

    // Невідомий запит
    return {
      statusCode: 404,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: 'Endpoint not found'
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    
    return {
      statusCode: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        message: 'Server error: ' + error.message
      })
    };
  }
};

// Функція для скидання даних (для тестування)
exports.reset = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod === 'POST') {
    teamData = {
      selections: [],
      counters: { team1: 0, team2: 0, team3: 0 }
    };

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Data reset successfully'
      })
    };
  }

  return {
    statusCode: 405,
    headers,
    body: JSON.stringify({ success: false, message: 'Method not allowed' })
  };
};