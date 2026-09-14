# Chart

Компактный график-спарклайн, который рисует четыре временных ряда разными типами отображения поверх одной оси времени. Тестовое задание: повторить стиль и поведение референса (скринкаст в корне репо).

## Language

**Chart**:
Один график, отрисованный в контейнере, с ровно четырьмя Series slots.
_Avoid_: widget, graph, sparkline component

**Series slot**:
Одна из четырёх фиксированных позиций графика, определяемая типом отображения: `area`, `spline`, `line`, `bar`. Имя и цвет ряда задаются входными данными.
_Avoid_: metric, dataset, layer

**Series**:
Именованный временной ряд, помещённый в Series slot: имя, цвет, Points.
_Avoid_: sequence, data line

**Point**:
Пара «момент времени — значение» внутри Series.
_Avoid_: sample, tick, record

**Independent scale**:
Своя невидимая вертикальная шкала у каждого Series slot; значения рядов не сравнимы по высоте между собой.
_Avoid_: shared axis, normalized values

**Shared tooltip**:
Всплывающая подсказка для одного момента времени, перечисляющая значения всех Series, у которых есть Point в этот момент.
_Avoid_: popup, hint, label
