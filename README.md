<div align="center">

# Homescreen NEO

**Tu espacio digital, reunido en un solo lugar.**

Una interfaz personalizable para acceder a herramientas, aplicaciones, juegos y recursos desde una única pantalla.

[**Abrir Homescreen NEO**](https://capybaragalaxy.github.io/HOMESCREEN/)

[![GitHub repository](https://img.shields.io/badge/GitHub-CapybaraGalaxy%2FHOMESCREEN-181717?logo=github)](https://github.com/CapybaraGalaxy/HOMESCREEN)
[![Web app](https://img.shields.io/badge/Web-App-0A84FF)](https://capybaragalaxy.github.io/HOMESCREEN/)
[![PWA](https://img.shields.io/badge/PWA-compatible-5A0FC8)](https://web.dev/progressive-web-apps/)

</div>

---

## ¿Qué es Homescreen NEO?

Homescreen NEO es una *homescreen* web que reúne accesos directos, utilidades, aplicaciones, juegos y recursos en una interfaz unificada. Está pensada para funcionar como punto de partida del día a día: abres la página y tienes a mano lo que utilizas habitualmente.

El proyecto prioriza una experiencia sencilla, visual y adaptable, sin convertir la pantalla de inicio en un panel recargado.

- **Un solo punto de acceso:** organiza tus herramientas y recursos desde una misma interfaz.
- **Personalizable:** adapta la presentación y el comportamiento de la pantalla a tus preferencias.
- **Multiplataforma:** utilízala desde un navegador moderno en ordenador, móvil o tablet.
- **Instalable:** incluye soporte para las capacidades de aplicación web progresiva (PWA) del navegador.
- **Sin anuncios:** la experiencia no depende de publicidad.
- **Enfoque local:** la aplicación está diseñada para funcionar como una experiencia web estática, sin necesitar una cuenta o un servidor de aplicación para su uso normal.

> Homescreen NEO es un proyecto en evolución. La organización, las herramientas disponibles y algunos detalles de la interfaz pueden cambiar con el tiempo. Este documento explica el proyecto y sus principios de funcionamiento, no una lista cerrada de funciones de una versión concreta.

## Acceder a la aplicación

La forma más sencilla de utilizar Homescreen NEO es abrir la versión publicada:

**[capybaragalaxy.github.io/HOMESCREEN](https://capybaragalaxy.github.io/HOMESCREEN/)**

No necesitas clonar el repositorio ni instalar dependencias para utilizar la versión alojada.

### Instalarla como aplicación

En navegadores compatibles puedes añadir Homescreen NEO a la pantalla de inicio o instalarla como aplicación:

1. Abre la dirección de Homescreen NEO en el navegador.
2. Abre el menú del navegador.
3. Selecciona **Instalar aplicación**, **Añadir a pantalla de inicio** o la opción equivalente.
4. Confirma la instalación.

El nombre exacto de la opción depende del navegador y del sistema operativo. La instalación PWA no está disponible de la misma forma en todos los navegadores.

## Experiencia e interfaz

Homescreen NEO está diseñada para adaptarse a distintos tamaños de pantalla y formas de uso. La interfaz combina una presentación visual minimalista con controles para acceder a las distintas áreas de la aplicación.

### Modos de visualización

La pantalla de inicio puede ofrecer distintas formas de organizar los elementos:

- **Burbuja:** presentación visual y compacta de los accesos.
- **Lista:** distribución lineal, útil para recorrer elementos de forma directa.
- **Cuadrícula:** organización en una cuadrícula de elementos.

La disponibilidad y el comportamiento concreto de cada modo dependen de la versión publicada.

### Configuración

La aplicación dispone de un área de configuración desde la que se pueden ajustar diferentes aspectos de la experiencia. Las opciones se organizan por categorías para facilitar su localización.

Entre los ámbitos de configuración del proyecto se encuentran:

- Inicio y comportamiento general.
- Pantalla de inicio y presentación de los elementos.
- Aplicaciones y accesos.
- Apariencia.
- Sonido y respuesta táctil.
- Sistema y datos.

Los nombres, opciones y controles pueden evolucionar. Consulta la propia aplicación para conocer los ajustes disponibles en cada momento.

## Aplicaciones, herramientas y contenido

Homescreen NEO no se limita a mostrar enlaces: el proyecto también reúne pequeñas aplicaciones, utilidades y secciones complementarias.

El repositorio organiza parte de este contenido en directorios independientes, lo que permite ampliar o mantener áreas del proyecto sin tener que convertir este README en un inventario que quede obsoleto con cada cambio.

Según la versión, el contenido puede incluir:

- **Aplicaciones y utilidades:** herramientas web integradas o accesibles desde la interfaz.
- **Juegos:** una sección dedicada a contenido relacionado con videojuegos.
- **Labs:** espacio para experimentos, funciones en desarrollo o propuestas que pueden cambiar.
- **Recursos multimedia:** imágenes, iconos y otros recursos visuales.
- **Herramientas de ventana:** utilidades auxiliares como notas, tareas, temporizadores, calculadora u organizadores, cuando estén disponibles en la versión publicada.

La lista anterior describe las áreas del proyecto, no garantiza que cada elemento esté presente en todas las versiones. La aplicación es la referencia actualizada del contenido disponible.

## Datos, privacidad y funcionamiento local

Homescreen NEO sigue un enfoque de aplicación web estática: los archivos necesarios para mostrar la interfaz se sirven desde el alojamiento web y el navegador ejecuta la aplicación en el dispositivo.

Esto tiene varias implicaciones:

- No necesitas crear una cuenta para abrir la aplicación.
- El uso normal no requiere un servidor propio ni una base de datos remota de la aplicación.
- Los datos y preferencias que la aplicación gestione localmente pueden permanecer en el almacenamiento del navegador del dispositivo.
- Los datos locales no se sincronizan automáticamente entre dispositivos salvo que una función específica indique lo contrario.
- Borrar los datos del sitio, el almacenamiento del navegador o el perfil del navegador puede eliminar información guardada localmente.

**Importante:** “local” no significa que todos los datos estén garantizados frente a pérdidas. El almacenamiento del navegador puede borrarse, limitarse o quedar inaccesible. Si la aplicación ofrece herramientas de copia de seguridad o exportación, utilízalas periódicamente para conservar la información que te importe.

La aplicación puede necesitar conexión a Internet para la primera carga, para descargar recursos externos que alguna función utilice o para abrir servicios y páginas de terceros. El comportamiento sin conexión depende de los recursos que el navegador haya almacenado y de las capacidades de la versión instalada.

### Servicios y enlaces de terceros

Algunos accesos pueden abrir páginas, aplicaciones o servicios externos. Esos servicios tienen sus propias políticas de privacidad, disponibilidad y condiciones de uso. El funcionamiento de Homescreen NEO no implica que esos servicios estén afiliados al proyecto.

## Actualizaciones

Homescreen NEO incorpora mecanismos de actualización propios de una aplicación web progresiva. El navegador puede conservar recursos en caché para acelerar la carga y permitir determinadas funciones sin conexión.

Por este motivo, después de publicar una actualización puede que el navegador tarde un poco en mostrarla, especialmente si mantiene una versión anterior en caché.

Si detectas que la aplicación no refleja una actualización:

1. Comprueba que estás utilizando la dirección oficial.
2. Recarga la página.
3. Si sigue apareciendo una versión anterior, cierra y vuelve a abrir la aplicación.
4. Si el problema persiste, consulta las opciones de actualización de la propia aplicación o borra los datos del sitio como último recurso.

Borrar los datos del sitio puede eliminar preferencias y datos almacenados localmente. Haz una copia de seguridad antes si la aplicación contiene información que quieras conservar.

## Compatibilidad

Homescreen NEO está destinada a navegadores modernos con soporte para tecnologías web actuales.

Puede utilizarse desde:

- Ordenadores de sobremesa y portátiles.
- Teléfonos Android.
- Tablets.
- Otros dispositivos con un navegador compatible.

La apariencia, las opciones de instalación y algunas funciones pueden variar entre navegadores y sistemas operativos. Para una experiencia más completa, se recomienda mantener el navegador actualizado.

## Accesibilidad y uso

La interfaz está pensada para el uso con pantalla táctil y con ratón, además de adaptarse a diferentes dimensiones de pantalla. Algunas interacciones pueden depender de las capacidades del dispositivo o del navegador.

Si encuentras un control que no responde, una sección que no se muestra correctamente o un problema de visualización, puedes comunicarlo mediante el sistema de incidencias del repositorio.

## El proyecto

Homescreen NEO es un proyecto personal desarrollado por **Guilleplayer** y publicado como sitio web estático.

- **Repositorio:** [CapybaraGalaxy/HOMESCREEN](https://github.com/CapybaraGalaxy/HOMESCREEN)
- **Aplicación:** [capybaragalaxy.github.io/HOMESCREEN](https://capybaragalaxy.github.io/HOMESCREEN/)
- **Incidencias y sugerencias:** [GitHub Issues](https://github.com/CapybaraGalaxy/HOMESCREEN/issues)
- **Código fuente:** [Explorar el repositorio](https://github.com/CapybaraGalaxy/HOMESCREEN)

### Tecnologías

El proyecto utiliza tecnologías web estándar. Su implementación se encuentra en el propio repositorio y puede evolucionar con el tiempo.

Entre los componentes técnicos presentes en el proyecto se incluyen:

- HTML para la estructura de las páginas.
- CSS para la presentación y el diseño adaptable.
- JavaScript para la lógica y las interacciones.
- Manifest y Service Worker para las capacidades PWA.
- Recursos y bibliotecas de terceros incluidos en el repositorio cuando son necesarios.

No se requiere un proceso de compilación para utilizar la versión publicada como usuario.

## Para desarrolladores

Si quieres examinar el código o trabajar en una copia del proyecto, puedes clonar el repositorio:

```bash
git clone https://github.com/CapybaraGalaxy/HOMESCREEN.git
cd HOMESCREEN
```

Después, abre el proyecto con un servidor web local. Por ejemplo, puedes utilizar la extensión **Live Server** de Visual Studio Code.

> Es preferible utilizar un servidor HTTP local en lugar de abrir directamente `index.html` mediante `file://`, ya que algunas funciones del navegador —como los Service Workers— requieren un contexto seguro o un servidor local compatible.

### Estructura del repositorio

El repositorio está organizado por páginas, recursos y módulos funcionales. La estructura puede ampliarse o reorganizarse a medida que evoluciona el proyecto.

| Ruta | Propósito |
|---|---|
| `index.html` | Punto de entrada principal de la aplicación. |
| `styles.css` | Estilos y presentación de la interfaz. |
| `Apps/` | Aplicaciones y utilidades agrupadas. |
| `Games/` | Contenido y recursos relacionados con juegos. |
| `Media/` | Recursos multimedia y gráficos. |
| `vendor/` | Dependencias y bibliotecas de terceros incluidas localmente. |
| `Backups/` | Archivos relacionados con copias de seguridad del proyecto. |
| `manifest.json` | Metadatos de instalación de la PWA. |
| `service-worker.js` | Gestión de caché y comportamiento del Service Worker. |
| `update-manager.js` | Lógica relacionada con la detección y gestión de actualizaciones. |
| `version.json` | Información de versión utilizada por los mecanismos de actualización. |
| `changelog.js` | Datos y presentación del registro de cambios. |
| `config.html` | Interfaz de configuración. |
| `about.html` | Información sobre la aplicación. |
| `games.html` | Página de la sección de juegos. |
| `labs.html` | Página de experimentos y funciones en desarrollo. |

Esta tabla describe la organización conocida del proyecto. Para conocer los archivos y módulos exactos de la versión actual, consulta directamente el repositorio.

### Desarrollo y publicación

La versión pública se sirve desde GitHub Pages. Los cambios que se integran en la rama de publicación se reflejan en el sitio cuando GitHub Pages termina el despliegue.

Si modificas el proyecto:

1. Trabaja sobre una copia del repositorio.
2. Comprueba los cambios en un servidor local.
3. Verifica las rutas, los recursos y las funciones principales.
4. Publica los cambios mediante Git y GitHub.
5. Comprueba la versión desplegada en la web.

Ten especial cuidado al modificar el Service Worker, la estrategia de caché o el gestor de actualizaciones: un error en estos componentes puede provocar que los usuarios sigan viendo recursos antiguos o que la aplicación no se actualice correctamente.

## Informar de errores o proponer mejoras

Las sugerencias, errores y propuestas pueden compartirse en GitHub:

[**Abrir incidencias del proyecto**](https://github.com/CapybaraGalaxy/HOMESCREEN/issues)

Al informar de un problema, intenta incluir:

- Qué estabas intentando hacer.
- Qué esperabas que ocurriera.
- Qué ocurrió realmente.
- Navegador y dispositivo utilizados.
- Pasos para reproducir el problema.
- Capturas de pantalla o mensajes de error, si ayudan a entenderlo.

No incluyas contraseñas, datos personales ni información privada en una incidencia pública.

## Licencias y atribuciones

Homescreen NEO puede incluir bibliotecas, iconos, fuentes u otros recursos de terceros. Sus respectivas licencias y avisos de atribución deben respetarse.

Consulta los archivos de licencia incluidos en el repositorio —por ejemplo, los avisos de bibliotecas de terceros— para conocer las condiciones aplicables a cada componente.

Salvo que el repositorio indique expresamente lo contrario, no debe asumirse que todos los recursos de terceros comparten la misma licencia que el código propio del proyecto.

---

<div align="center">

**Homescreen NEO**

Hecho para tenerlo todo a mano.

[Aplicación](https://capybaragalaxy.github.io/HOMESCREEN/) · [Repositorio](https://github.com/CapybaraGalaxy/HOMESCREEN) · [Incidencias](https://github.com/CapybaraGalaxy/HOMESCREEN/issues)

</div>
