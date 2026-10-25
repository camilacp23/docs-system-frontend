# Verificación E2E de los Módulos 2 y 3 (variables y colecciones)

Registro de la verificación manual de los Módulos 2 (Variables) y 3 (Colecciones) contra la **sandbox del
backend**, en **Chrome y Edge actuales** (NFR-18). El entorno se levanta como en la sección 1.1 de
`VERIFICACION_E2E_MODULO1.md`. Este documento registra solo los resultados verificados a mano.

## 1. Chrome — variables (F-06)

| Comprobación                                              | Resultado |
| --------------------------------------------------------- | --------- |
| Listado                                                   | OK        |
| Filtros en la URL                                         | OK        |
| Creación                                                  | OK        |
| Duplicado                                                 | OK        |
| Detalle con dependencias                                  | OK        |
| `SCOPE_CONFLICT` con la colección                         | OK        |
| 412 en dos pestañas                                       | OK        |
| Revalidación (`Cache-Control: no-cache`, 200/304)         | OK        |
| Sin conexión                                              | OK        |
| Borrado con impacto                                       | OK        |
| `/dev/ui`                                                 | OK        |

## 2. Chrome — colecciones (F-07)

| Comprobación                                              | Resultado |
| --------------------------------------------------------- | --------- |
| Listado y subtítulo                                       | OK        |
| Filtro de no documentadas                                 | OK        |
| Creación                                                  | OK        |
| Pestañas en la URL                                        | OK        |
| Intercambio de nombres y reordenar                        | OK        |
| Asignación visible en la variable                         | OK        |
| `SCOPE_MISMATCH` en su fila                               | OK        |
| Duplicado en su fila con resumen                          | OK        |
| La colección no se ofrece como derivada de sí misma       | OK        |
| 412                                                       | OK        |
| Borrado con impacto                                       | OK        |

## 3. Chrome — roles, D-78, aplicación archivada, teclado y anchos (F-08)

| #   | Comprobación                                                                                                       | Resultado |
| --- | ------------------------------------------------------------------------------------------------------------------ | --------- |
| 1   | Reader: barra lateral de 8 opciones                                                                                | OK        |
| 2   | Reader: listados y detalles sin acciones de escritura                                                              | OK        |
| 3   | Reader: URLs `/edit` de variables y colecciones → No access                                                        | OK        |
| 4   | Developer: 10 opciones; crea y edita una variable                                                                  | OK        |
| 5   | Cambio automático de aplicación al abrir una variable de otra aplicación, con toast                                | OK        |
| 6   | Cambio manual desde la tarjeta lateral → vuelve a `/variables`                                                     | OK        |
| 7   | Aplicación archivada: banner con Unarchive y New/Edit/Delete deshabilitados con razón, en variables y colecciones | OK        |
| 8   | URL `/edit` con la aplicación archivada → Save deshabilitado con razón                                             | OK        |
| 9   | Unarchive desde el banner → vuelve a editar sin perder datos                                                       | OK        |
| 10  | Modal con teclado (Tab, Shift+Tab, Esc, foco devuelto)                                                             | OK        |
| 11  | Anchos de 1280 y 1024 px sin desplazamiento horizontal                                                             | OK        |

## 4. Edge

Pasos a, c, d, e, f y g de variables; c, d, e y f de colecciones; y el paso 3 con el Reader: OK.
