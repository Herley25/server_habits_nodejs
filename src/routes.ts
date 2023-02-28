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

    return {
      possibleHabits,
    };
  });
}
