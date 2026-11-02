import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { EditorView, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { history, undo } from '@codemirror/commands'
import AiPanel from '../../frontend/js/components/ai-panel'
import CorregirLog from '../../frontend/js/components/corregir-log'
import AccionesSeleccion from '../../frontend/js/components/acciones-seleccion'
import SolicitudProvider from '../../frontend/js/solicitud-context'
import { Banco } from './adaptadores'
import { extension as vigilarDeclaracion } from '../../frontend/js/declaracion-extension'

function App() {
  const contenedor = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<EditorView | null>(null)
  const [revision, setRevision] = useState(0)
  const [escribir, setEscribir] = useState(!location.search.includes('lectura'))
  useEffect(() => {
    const editor = new EditorView({
      parent: contenedor.current!,
      state: EditorState.create({
        doc: 'La velocidad es v_0 = 3 m/s.',
        extensions: [lineNumbers(), history(), vigilarDeclaracion()],
      }),
      dispatchTransactions: trs => {
        editor.update(trs)
        setRevision(r => r + 1)
      },
    })
    setView(editor)
    Object.assign(window, {
      bancoIA: { view: editor, deshacer: () => undo(editor) },
    })
    return () => editor.destroy()
  }, [])
  return (
    <>
      <header className="banco-cabecera">
        <strong>AEMCiCD · Fase 2</strong>
        <span>
          Banco local de componentes · respuestas simuladas · sin conexión a
          Azure
        </span>
      </header>
      <div className="banco-layout">
        <main>
          <div className="banco-barra">
            <strong>main.tex</strong>
            <button onClick={() => setEscribir(e => !e)}>
              Cambiar permiso de edición
            </button>
          </div>
          <div className="banco-editor" ref={contenedor} />
          {view && (
            <Banco.Provider value={{ view, revision, escribir }}>
              <SolicitudProvider>
                <div className="banco-menu" aria-label="Menú de selección">
                  <button>Comentar</button>
                  <AccionesSeleccion />
                </div>
                <section className="banco-log">
                  <h2>Logs del PDF</h2>
                  <div>
                    <strong>Missing $ inserted</strong>
                    <span>main.tex, línea 1</span>
                    <CorregirLog
                      logEntry={{
                        key: 'e1',
                        level: 'error',
                        message: 'Missing $ inserted',
                        raw: '! Missing $ inserted.\nl.1 La velocidad es v_0 = 3 m/s.',
                        file: './main.tex',
                        line: 1,
                      }}
                    />
                  </div>
                </section>
                <aside>
                  <AiPanel />
                </aside>
              </SolicitudProvider>
            </Banco.Provider>
          )}
        </main>
      </div>
    </>
  )
}
createRoot(document.getElementById('app')!).render(<App />)
