# Mi Día v1.3 — copia de trabajo

Base: Mi Día v1.2. La v1.1 protegida permanece intacta.

## Novedades v1.3
- Melodía configurable por evento: Campana suave, Tono clásico, Alarma digital, Piano, Naturaleza, Mar, Notificación moderna y Recordatorio amable.
- Volumen independiente por alarma (0–100%).
- Vibración independiente por alarma con patrones Estándar, Corta, Doble, Triple y Larga.
- Botones para probar sonido y vibración antes de guardar.
- Mantiene repetición única, cada 5 min, diaria o por días específicos.
- Mantiene apariencia Sistema / Claro / Oscuro.
- Service worker v1.3 con detección de actualización y botón “Actualizar”. Al publicar una versión posterior sobre EL MISMO dominio/proyecto, la PWA instalada detecta el nuevo service worker y puede recargarse a la nueva versión.

## Importante sobre Android/PWA
El volumen configurado controla el sonido generado dentro de Mi Día mientras la app está activa. Los navegadores y Android pueden limitar el audio personalizado de notificaciones cuando la PWA está totalmente cerrada; la vibración y las notificaciones también dependen de permisos y políticas del dispositivo. Para alarmas nativas exactas con audio personalizado aun cerrada, se requiere una app Android nativa.


## v1.4 identidad visual
- Grafito/antracita inspirado en la referencia nocturna.
- Franjas y halos azul petróleo/azul profundo difuminados.
- Conserva Sistema, Claro y Oscuro.
- El logo actual se mantiene temporalmente hasta aprobar el nuevo logo.
- Cache PWA actualizado a v1.4 para propagar cambios a instalaciones existentes al publicar en el mismo dominio.
