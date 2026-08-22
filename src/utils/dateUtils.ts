import { Recurrence } from '../types.ts';

export function formatISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseISO(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Calcula a próxima data com base na regra de recorrência
 * @param currentDateStr Data base em formato YYYY-MM-DD
 * @param recurrence Tipo de recorrência ('Segunda a Sexta', 'Diariamente', 'Semanalmente', 'Mensalmente')
 * @returns Nova data em formato YYYY-MM-DD ou null se não houver recorrência
 */
export function getNextRecurrenceDate(
  currentDateStr: string,
  recurrence: Recurrence
): string | null {
  if (!currentDateStr || recurrence === 'Nenhuma') {
    return null;
  }

  const [y, m, d] = currentDateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  if (recurrence === 'Segunda a Sexta') {
    // Adiciona 1 dia
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay(); // 0 = Domingo, 6 = Sábado
    if (dayOfWeek === 6) {
      // Se caiu no Sábado, avança 2 dias para Segunda-feira
      date.setDate(date.getDate() + 2);
    } else if (dayOfWeek === 0) {
      // Se caiu no Domingo, avança 1 dia para Segunda-feira
      date.setDate(date.getDate() + 1);
    }
  } else if (recurrence === 'Diariamente') {
    date.setDate(date.getDate() + 1);
  } else if (recurrence === 'Semanalmente') {
    date.setDate(date.getDate() + 7);
  } else if (recurrence === 'Mensalmente') {
    date.setMonth(date.getMonth() + 1);
  } else {
    return null;
  }

  return formatISO(date);
}

export const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export const WEEKDAYS_PT = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado'
];

export const WEEKDAYS_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Retorna os 7 dias da semana (de Domingo a Sábado) para uma data de referência
 */
export function getWeekDates(referenceDate: Date): Date[] {
  const date = new Date(referenceDate);
  const day = date.getDay(); // 0 = Domingo, 1 = Segunda, etc.
  
  // Retroceder até o Domingo da semana atual
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - day);
  sunday.setHours(0, 0, 0, 0);

  const week: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const current = new Date(sunday);
    current.setDate(sunday.getDate() + i);
    week.push(current);
  }
  return week;
}

/**
 * Retorna texto formatado da semana, ex: "16 a 22 de Agosto de 2026"
 */
export function formatWeekInterval(weekDates: Date[]): string {
  if (weekDates.length < 7) return '';
  const first = weekDates[0];
  const last = weekDates[6];

  const firstDay = first.getDate();
  const lastDay = last.getDate();
  const firstMonth = MONTH_NAMES_PT[first.getMonth()];
  const lastMonth = MONTH_NAMES_PT[last.getMonth()];
  const year = last.getFullYear();

  if (first.getMonth() === last.getMonth()) {
    return `${firstDay} a ${lastDay} de ${lastMonth} de ${year}`;
  }
  return `${firstDay} de ${firstMonth} a ${lastDay} de ${lastMonth} de ${year}`;
}

/**
 * Retorna as células do calendário mensal (incluindo dias padding do mês anterior/seguinte)
 */
export interface MonthDayCell {
  date: Date;
  dateString: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export function getMonthGrid(year: number, month: number, today: Date): MonthDayCell[] {
  const todayStr = formatISO(today);
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Dom, 1 = Seg...
  const totalDaysInMonth = lastDayOfMonth.getDate();

  const cells: MonthDayCell[] = [];

  // Dias do mês anterior para completar a primeira semana
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthLastDay - i);
    const dateStr = formatISO(date);
    cells.push({
      date,
      dateString: dateStr,
      dayNumber: date.getDate(),
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  // Dias do mês atual
  for (let d = 1; d <= totalDaysInMonth; d++) {
    const date = new Date(year, month, d);
    const dateStr = formatISO(date);
    cells.push({
      date,
      dateString: dateStr,
      dayNumber: d,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
    });
  }

  // Dias do próximo mês para completar a grade de 35 ou 42 células
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(year, month + 1, d);
    const dateStr = formatISO(date);
    cells.push({
      date,
      dateString: dateStr,
      dayNumber: d,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
    });
  }

  return cells;
}
