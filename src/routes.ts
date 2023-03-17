import dayjs from 'dayjs';
import {
    FastifyInstance,
} from 'fastify';
import {
    z,
} from 'zod';

import {
    prisma,
} from './lib/prisma';

export async function appRoutes(app: FastifyInstance) {
  /**
   * Método HTTP: Get, Post, Patch, Delete
   */
  app.post("/habits", async (request) => {
    // Zod trata as validações dos campos e trás as tipagem !
    const createHabitBody = z.object({
      title: z.string(),
      weekDays: z.array(z.number().min(0).max(6)),
    });

    const { title, weekDays } = createHabitBody.parse(request.body);

    // startOf zera as horas, minutos e segundos
    const today = dayjs().startOf("day").toDate();

    await prisma.habit.create({
      data: {
        title,
        create_at: today,
        weekDays: {
          create: weekDays.map((weekDay) => {
            return {
              week_day: weekDay,
            };
          }),
        },
      },
    });
  });

  app.get("/day", async (request) => {
    const getDayParams = z.object({
      // coerce vai converter o paramêtro em uma data, e ira me entregar o valor manipulado
      date: z.coerce.date(),
    });

    const { date } = getDayParams.parse(request.query);

    const parsedDate = dayjs(date).startOf("day");
    const weekDay = parsedDate.get("day");

    console.log(date, weekDay);

    /**
     * os hábitos possíveis
       hábitos que já foram completados
     */
    const possibleHabits = await prisma.habit.findMany({
      where: {
        create_at: {
          lte: date,
        },
        weekDays: {
          some: {
            week_day: weekDay,
          },
        },
      },
    });

    // Detalhe do dia
    const day = await prisma.day.findUnique({
      where: {
        date: parsedDate.toDate(),
      },
      include: {
        dayHabits: true,
      },
    });

    const completedHabits =
      day?.dayHabits.map((dayHabit) => {
        return dayHabit.habit_id;
      }) ?? [];

    return {
      possibleHabits,
      completedHabits,
    };
  });

  // Completar e não completar um hábito
  app.patch("/habits/:id/toggle", async (request) => {
    // route params => parâmetro de identificação
    const toggleHabitParams = z.object({
      id: z.string().uuid(),
    });

    const { id } = toggleHabitParams.parse(request.params);

    // Acompanhamento diário de hábitos
    const today = dayjs().startOf("day").toDate();

    let day = await prisma.day.findUnique({
      where: {
        date: today,
      },
    });
    // se o dia não estiver registrado no banco
    if (!day) {
      day = await prisma.day.create({
        data: {
          date: today,
        },
      });
    }

    const dayHabit = await prisma.dayHabit.findUnique({
      where: {
        day_id_habit_id: {
          day_id: day.id,
          habit_id: id,
        },
      },
    });

    // se o registro esteja no banco de dados
    if (dayHabit) {
      // remover a marcação de completo
      await prisma.dayHabit.delete({
        where: {
          id: dayHabit.id,
        },
      });
    } else {
      // serve para completar o hábito no dia atual
      await prisma.dayHabit.create({
        data: {
          day_id: day.id,
          habit_id: id,
        },
      });
    }
  });

  app.get("/summary", async () => {
    /**
     * Query mais complexas, mais consições, relacionamentos => SQL na mão (RAW)
     * Prisma ORM: RAW SQL => SQLite
     * retornar uma lista, data, dia, quantos hábitos eram possíveis de completar nesta data
     * e quantos hábitos eu consigo terminar neste dia
     */

    const summary = await prisma.$queryRaw`
      SELECT
        D.id,
        D.date,
        (
          SELECT
            cast(count(*) as float)
          FROM day_habits DH
          WHERE DH.day_id = D.id
        ) as completed,
        (
          SELECT
            cast(count(*) as float)
          FROM habit_week_days HWD
          JOIN habits H
            ON H.id = HWD.habit_id
          WHERE
            HWD.week_day = cast(strftime('%w', D.date/1000.0, 'unixepoch') as int)
            AND H.create_at <= D.date
        ) as amount
      FROM days D
    `;

    // Epoch converter formato que o SQLite guarda
    return summary;
  });
}
