# Guía de uso

## Acceso y permisos

Inicia sesión con una cuenta activa. El menú muestra únicamente módulos permitidos por el
rol. En **Usuarios y roles** el administrador puede crear cuentas, desactivarlas y ajustar
permisos por módulo. Cuando el rol es **Alumno**, también debe seleccionar la matrícula
que corresponde a la cuenta.

Acceso de ejemplo del alumno: `alumno@campusfrontera.edu.mx` / `Alumno123!`.

## Preparación académica

1. Abre **Catálogos**.
2. Configura nivel, programa, turnos y ciclo escolar.
3. Crea periodos y grupos vinculados al ciclo.
4. Registra materias, docentes, criterios y escalas.
5. En **Planes académicos**, registra el plan y agrega todas sus asignaturas, indicando si
   son obligatorias u optativas, sus créditos y el periodo sugerido.
6. En **Calificaciones**, crea las asignaciones de materia, grupo, docente y periodo.

Las ponderaciones de una asignación deben sumar 100%.

## Alumnos

Usa **Nuevo alumno** para registrar identidad, contacto e inscripción. La búsqueda y los
filtros permiten localizar alumnos por programa o grupo.

Para una carga masiva:

1. Selecciona **Importar**.
2. Descarga la plantilla.
3. Carga Excel o CSV.
4. Revisa filas válidas y errores.
5. Elige ignorar o actualizar matrículas existentes.
6. Confirma la importación.

## Calificaciones

Al crear una asignación selecciona **Tres parciales**, **Criterios ponderados** o
**Calificación final**. En tres parciales, el sistema calcula el promedio con los valores
capturados y marca el resultado definitivo cuando los tres están completos. En criterios,
el resultado se calcula por ponderación.

## Portal del alumno

El rol **Alumno** entra directamente a **Mi avance**. La vista presenta sus materias,
docente, tres parciales, promedio, créditos obtenidos y porcentaje de avance curricular.
Una materia aporta sus créditos cuando la calificación definitiva es aprobatoria; el 100%
corresponde a la suma total de créditos del plan asignado a su inscripción.

**Cerrar** bloquea cambios posteriores. Cada edición conserva valor anterior, valor nuevo,
usuario, fecha y motivo. El icono de historial muestra esa bitácora.

La importación de calificaciones valida matrícula, programa, turno, grupo, materia,
periodo, rango y estado de captura antes de permitir la confirmación.

## Cobros y estados de cuenta

En **Cobros**, busca y selecciona al alumno para consultar sus pagos y saldo. En el
encabezado de la cuenta, **PDF carta** abre un estado de cuenta institucional listo para
imprimir y **Excel** descarga el mismo formato con una segunda pestaña que conserva el
historial completo de movimientos. Cuando existen más de 12 pagos, tanto el PDF como la
pestaña **Estado de Cuenta** del Excel agregan automáticamente las hojas carta necesarias;
cada hoja repite encabezado, datos del alumno, totales, firma y código de verificación.

Al registrar o editar un pago, captura el **NÚMERO DE FOLIO FÍSICO** impreso en el recibo,
usando cuatro dígitos del **0001 al 1000**. El sistema conserva por separado su identificador
interno; los estados de cuenta muestran únicamente el folio físico.

## Asistencia y autorización para evaluar

La sección **Asistencia** muestra al docente únicamente sus materias y grupos. El correo de su
usuario debe coincidir con el correo capturado en el catálogo de docentes. Para cada mes se
captura el total de clases impartidas y el número de asistencias de cada alumno; puede guardarse
como borrador y posteriormente confirmarse.

El alumno consulta los meses confirmados desde **Mi avance**. Para que un docente pueda capturar
su evaluación, el alumno debe acumular al menos **80% de asistencia confirmada** en la materia y
tener un pago identificado como **Inscripción** o **Reinscripción** dentro del periodo académico.
El estado de reinscripción también aparece en Alumnos y Cobros.

En **Colegiaturas mensuales**, al marcar un mes como pagado el concepto se genera con el
mes y el año correspondientes, por ejemplo **Colegiatura agosto 2026**.

Ambos documentos toman automáticamente la matrícula, nombre, programa, turno, periodo,
ciclo, pagos y total pagado. También incorporan el logo y responsable definidos en
**Configuración**, la fecha y hora de emisión, el lugar **Frontera, Centla, Tab.** y un
código de verificación SHA-256.

## Boletas y reportes

En **Reportes** selecciona alumno o grupo para generar boletas PDF. El navegador abre el
documento para descargarlo o imprimirlo.

Los formatos operativos incluyen:

- Lista de alumnos
- Lista de asistencia
- Concentrado de calificaciones
- Reporte por materia
- Reporte por docente
- Alumnos reprobados
- Alumnos destacados

## Configuración institucional

En **Configuración** define nombre, dirección, contacto, responsable, ciclo activo, escala,
logo, colores y pie de página. Estos valores se aplican a boletas y documentos.

La pestaña **Actividad** muestra acciones administrativas recientes.

## Edición y eliminación

En **Planes académicos** usa **Editar** para modificar el programa, versión, datos generales
y la lista completa de asignaturas. **Eliminar** borra definitivamente el plan y desvincula
las inscripciones que lo utilizaban.

En alumnos y catálogos, el menú de acciones mantiene **Desactivar** y añade **Eliminar
definitivamente**. El borrado permanente de un alumno incluye inscripciones, calificaciones
y su cuenta vinculada. Para otros catálogos, el sistema bloquea la operación si el registro
todavía tiene dependencias que deben reasignarse.

Al activar **Forzar borrado**, el sistema elimina también las dependencias del registro,
como grupos, inscripciones, asignaciones y calificaciones. La advertencia y el botón cambian
antes de confirmar para distinguir claramente esta operación irreversible.
