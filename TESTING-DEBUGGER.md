# Testing Debugger Integration

## 🎯 Objetivo
Probar que la extensión hoverLookup puede obtener valores reales de variables desde el debugger de VSCode cuando estás en un breakpoint.

## 📋 Prerequisitos
1. La extensión debe estar cargada en el Extension Development Host
2. Tener el archivo `lookup-database.json` en la raíz del workspace
3. Tener el archivo `test-debug-example.js` en la raíz del workspace

## 🚀 Pasos para probar

### Paso 1: Iniciar la extensión
1. Abre este proyecto en VSCode
2. Presiona `F5` para iniciar el Extension Development Host
3. Se abrirá una nueva ventana de VSCode con la extensión cargada

### Paso 2: Abrir el archivo de prueba
1. En la nueva ventana, abre el archivo `test-debug-example.js`
2. Verifica que el archivo `lookup-database.json` esté presente en el workspace

### Paso 3: Configurar el breakpoint
1. Pon un breakpoint en la línea que dice `console.log("Dynamic ID:", dynamicId);`
2. Esto está marcado con el comentario `// <-- BREAKPOINT AQUÍ`

### Paso 4: Iniciar el debugger
1. En la nueva ventana, presiona `F5` o ve a Run > Start Debugging
2. Selecciona "Debug Test File" en el dropdown si aparece
3. El debugger se pausará en el breakpoint

### Paso 5: Probar el hover con debugger
Ahora que estás pausado en el breakpoint, haz hover sobre estas variables:

- **`userId`** → Debería mostrar el registro con id=1 de la base de datos
- **`userName`** → Debería mostrar el registro con id="abc" de la base de datos  
- **`numericId`** → Debería mostrar el registro con id=2 de la base de datos
- **`dynamicId`** → Debería mostrar el registro correspondiente al valor calculado en runtime
- **`computedValue`** → Debería mostrar el registro con id=2 (userId + 1)

## ✅ Comportamiento esperado

### CON debugger activo (en breakpoint):
- **Debug Adapter Tracker** intercepta las respuestas del debugger
- Cuando haces hover sobre una variable, el debugger evalúa su valor
- Nuestro tracker captura ese valor y busca en la base de datos
- **AGREGA** la información de la base de datos al hover del debugger
- Verás: el valor de la variable + "🔍 Lookup Database:" + el JSON de la base de datos

### SIN debugger activo (código normal):
- El **HoverProvider** normal se activa
- Para literales (números, strings): busca directamente en la base de datos
- Para variables: usa análisis estático del código
- Muestra: "🔍 Lookup Result for `valor`" + el JSON de la base de datos

## 🔍 Debugging de la extensión

Para ver los logs de la extensión:
1. En la ventana ORIGINAL de VSCode (no el Extension Development Host)
2. Ve a View > Output
3. Selecciona "Extension Host" en el dropdown
4. Verás logs como:
   ```
   [DEBUG] Attempting to evaluate "userId" in active debug session
   [DEBUG] Got value from debugger for "userId": 1
   ```

## 🐛 Troubleshooting

### El hover no muestra nada
- Verifica que la base de datos esté cargada (debería aparecer un mensaje al iniciar)
- Verifica que el valor de la variable exista en la base de datos
- Revisa los logs en Output > Extension Host

### El debugger no se detiene
- Verifica que el breakpoint esté habilitado (debe ser un círculo rojo sólido)
- Asegúrate de estar ejecutando "Debug Test File" y no "Run Extension"

### El hover muestra el valor incorrecto
- Si estás en un breakpoint, debería usar el valor del debugger
- Si no estás en un breakpoint, usa análisis estático
- Revisa los logs para ver qué método se está usando

## 📊 Casos de prueba

| Variable | Valor en runtime | ID en DB | Resultado esperado |
|----------|------------------|----------|-------------------|
| userId | 1 | 1 | {"id": 1, "name": "John Doe", "age": 30} |
| userName | "abc" | "abc" | {"id": "abc", "name": "Bob Johnson", "age": 40} |
| numericId | 2 | 2 | {"id": 2, "name": "Jane Smith", "age": 25} |
| dynamicId | 1 o 2 | 1 o 2 | Registro correspondiente |
| computedValue | 2 | 2 | {"id": 2, "name": "Jane Smith", "age": 25} |

## 🎉 Éxito
Si puedes hacer hover sobre `dynamicId` o `computedValue` y ver el valor correcto basado en el cálculo en runtime, ¡la integración con el debugger está funcionando!

