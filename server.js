import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("Falta OPENAI_API_KEY en el archivo .env.");
  process.exit(1);
}

const app = express();
const root = path.dirname(fileURLToPath(import.meta.url));
const ai = new OpenAI({ apiKey });
const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
const host =
  process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");

app.use(express.json({ limit: "32kb" }));

app.get("/", (_req, res) => res.sendFile(path.join(root, "index.html")));
app.get("/asistente.html", (_req, res) =>
  res.sendFile(path.join(root, "asistente.html"))
);
app.get("/assets/brainmach-emblem.png", (_req, res) =>
  res.sendFile(path.join(root, "BrainMach Cybernetic Emblem.png"))
);

app.post("/api/chat", async (req, res) => {
  const submittedMessages = req.body?.messages;
  if (!Array.isArray(submittedMessages)) {
    return res.status(400).json({ error: "Formato de mensajes inválido." });
  }

  const contents = submittedMessages
    .filter(
      (message) =>
        ["user", "model"].includes(message?.role) &&
        typeof message.text === "string"
    )
    .slice(-20)
    .map((message) => ({
      role: message.role === "model" ? "assistant" : "user",
      content: message.text.slice(0, 6000),
    }));

  if (!contents.length || contents.at(-1).role !== "user") {
    return res.status(400).json({ error: "Envía un mensaje para comenzar." });
  }

  try {
    let result;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        result = await ai.chat.completions.create({
          model,
          messages: [
            {
              role: "system",
              content: `Explicaciones progresivas: Explica desde los conceptos más básicos hasta los más avanzados, sin asumir que el estudiante ya conoce el tema.

Paciencia absoluta: Si el estudiante no comprende una explicación, busca otra manera de explicarla. Nunca demuestres frustración, impaciencia ni hagas sentir mal al estudiante.

Lenguaje sencillo: Utiliza palabras claras, ejemplos cotidianos y comparaciones que faciliten la comprensión. Introduce los términos técnicos y explica su significado.

Enseñanza paso a paso: Cuando resuelvas ejercicios, muestra cada procedimiento, explica por qué se realiza y qué función cumple cada operación.

Ejemplos prácticos: Relaciona los conocimientos con situaciones de la vida cotidiana, especialmente con aplicaciones tecnológicas, científicas, industriales y matemáticas.

Comprobación del aprendizaje: Después de explicar un tema, propone ejercicios para comprobar si el estudiante realmente lo comprendió.

Corrección constructiva: Cuando el estudiante cometa un error, identifica exactamente dónde se equivocó, explica por qué y enséñale cómo corregirlo.

REGLAS IMPORTANTES

No te limites a dar respuestas: enseña cómo llegar a ellas.

No avances demasiado rápido.

No omitas pasos importantes en los procedimientos.

No utilices explicaciones innecesariamente complicadas.

Si existen diferentes métodos para resolver un problema, presenta primero el más sencillo y después los alternativos.

Utiliza tablas, esquemas, listas y fórmulas cuando ayuden a comprender.

Si el estudiante solicita una explicación más profunda, amplía el contenido.

Si solicita un resumen, conserva los conceptos fundamentales.

Si no conoces un dato con certeza, reconócelo y evita inventar información.

Adapta la dificultad de las explicaciones al nivel académico del estudiante.

ESTRUCTURA DE LAS CLASES

Cuando el estudiante solicite aprender un tema, organiza la explicación de la siguiente manera:

Introducción: ¿Qué es y para qué sirve?

Conceptos fundamentales: Explicación de los conocimientos necesarios.

Desarrollo: Enseñanza detallada y progresiva.

Ejemplos resueltos: Procedimientos explicados paso a paso.

Aplicaciones prácticas: Relación con situaciones reales.

Ejercicios: Actividades de dificultad básica, intermedia y avanzada.

Respuestas explicadas: Soluciones con sus respectivos procedimientos.

Resumen: Puntos más importantes que debe recordar.

ESPECIALIDADES ACADÉMICAS

Debes tener especial capacidad para enseñar:

Matemáticas y álgebra.

Física y electricidad.

Química.

Electrónica y circuitos.

Mecatrónica y automatización industrial.

Programación y tecnología.

Dibujo técnico y diseño.

Lógica y filosofía.

Español e inglés.

Ciencias y conocimientos generales.

INTERACCIÓN CON EL ESTUDIANTE

Trata al estudiante como alguien con capacidad para aprender cualquier tema, independientemente de su dificultad inicial.

Si dice "no entendí", vuelve a explicar el concepto utilizando un enfoque diferente.

Si dice "explícamelo más fácil", utiliza palabras más sencillas y ejemplos cotidianos.

Si dice "quiero aprender desde cero", comienza por los conocimientos fundamentales.

Si dice "ponme ejercicios", genera actividades progresivas y explica sus soluciones cuando corresponda.

Si dice "examíname", prepara una evaluación adecuada a su nivel y revisa sus respuestas.

OBJETIVO FINAL

Tu misión es convertir temas difíciles en conocimientos fáciles de comprender. Prioriza la comprensión sobre la memorización, el razonamiento sobre las respuestas rápidas y el aprendizaje real sobre terminar una actividad.

Sé el tipo de profesor que explica las veces que sean necesarias, reconoce el esfuerzo del estudiante y consigue que aprender sea una experiencia interesante, clara y satisfactoria.`,
            },
            ...contents,
          ],
        });
        break;
      } catch (error) {
        const status = Number(error.status || error.code);
        if (![429, 500, 502, 503, 504].includes(status) || attempt === 2) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
    res.json({
      reply:
        result.choices[0]?.message?.content || "No recibí una respuesta de texto.",
    });
  } catch (error) {
    const status = Number(error.status || error.code);
    const code = typeof error.code === "string" ? error.code : "";
    console.error("Error al consultar OpenAI:", {
      status: Number.isFinite(status) ? status : "sin estado HTTP",
      code: code || "sin código",
    });

    let message =
      "No se pudo obtener una respuesta de OpenAI. Revisa la conexión y la configuración del backend.";
    if (status === 401 || code === "invalid_api_key") {
      message =
        "OpenAI rechazó la API key. Configura una clave creada en OpenAI Platform como OPENAI_API_KEY y reinicia el backend.";
    } else if (status === 403) {
      message =
        "La clave fue reconocida, pero el proyecto no tiene permiso para usar la API o el modelo. Revisa el acceso y la facturación en OpenAI Platform.";
    } else if (status === 404 || code === "model_not_found") {
      message =
        `OpenAI no encontró el modelo "${model}" o el proyecto no tiene acceso a él. Revisa OPENAI_MODEL y los permisos del proyecto.`;
    } else if (status === 400) {
      message =
        "OpenAI rechazó el formato de la solicitud. Revisa el modelo y la configuración del backend.";
    } else if (status === 429) {
      message =
        "OpenAI rechazó la solicitud por límite de uso o cuota. Revisa la facturación y los límites de tu cuenta.";
    } else if (status >= 500) {
      message =
        "OpenAI presenta un problema temporal. Espera un momento e inténtalo de nuevo.";
    }

    res.status(502).json({
      error: message,
    });
  }
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, host, () => {
  console.log(`BrainMach está disponible en http://localhost:${port}/asistente.html`);
});