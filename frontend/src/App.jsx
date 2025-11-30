import React, { useEffect, useState } from 'react'

export default function App() {
  const [status, setStatus] = useState('Loading...')
  const [quizzes, setQuizzes] = useState([])
  const [currentQuiz, setCurrentQuiz] = useState(null)
  const [displayQuiz, setDisplayQuiz] = useState(null)
  const [submitted, setSubmitted] = useState(false)
  const [score, setScore] = useState(null)

  // Grade boundaries in points (for a 45-question quiz)
  const GRADE_RANGES = [
    { grade: 'A', min: 40, max: 45 },
    { grade: 'B', min: 35, max: 39 },
    { grade: 'C', min: 29, max: 34 },
    { grade: 'D', min: 24, max: 28 },
    { grade: 'E', min: 19, max: 23 },
    { grade: 'F', min: 0,  max: 18 },
  ]

  function percent(n, total) {
    if (!total) return 0
    return (n / total) * 100
  }

  function formatPct(v) {
    return `${v.toFixed(1)}%`
  }

  function determineGrade(score, total) {
    if (total === 0) return null
    // Map grade ranges to current total by scaling points
    // The grade ranges are defined for 45 points; scale thresholds proportionally
    const SCALE = total / 45
    for (const r of GRADE_RANGES) {
      const minScaled = Math.ceil(r.min * SCALE - 1e-9)
      const maxScaled = Math.floor(r.max * SCALE + 1e-9)
      if (score >= minScaled && score <= maxScaled) return r.grade
    }
    // If above highest, return A
    if (score > Math.ceil(GRADE_RANGES[0].max * (total / 45))) return 'A'
    return 'F'
  }
  const [answers, setAnswers] = useState({})

  // Shuffle helper
  function shuffleArray(arr) {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      const tmp = a[i]
      a[i] = a[j]
      a[j] = tmp
    }
    return a
  }

  function prepareDisplayQuiz(q) {
    if (!q) return null
    const copy = { ...q, questions: q.questions.map((ques) => {
      const choicesWithIdx = ques.choices.map((c, idx) => ({ text: c, orig: idx }))
      const shuffled = shuffleArray(choicesWithIdx)
      const correctIndex = shuffled.findIndex((c) => c.orig === ques.answerIndex)
      return {
        question: ques.question,
        choices: shuffled.map((s) => s.text),
        correctIndex,
      }
    }) }
    return copy
  }

  // Generate a mixed quiz by drawing random questions from all loaded quizzes
  function generateMixedQuiz(num = 25) {
    if (!quizzes || quizzes.length === 0) {
      alert('Quizzes not loaded yet.')
      return
    }

    const all = []
    quizzes.forEach((qz) => {
      if (qz && Array.isArray(qz.questions)) {
        qz.questions.forEach((qq) => {
          // keep original shape
          if (qq && qq.question && Array.isArray(qq.choices)) {
            all.push({ question: qq.question, choices: qq.choices, answerIndex: qq.answerIndex })
          }
        })
      }
    })

    if (all.length === 0) {
      alert('No questions found in available quizzes.')
      return
    }

    // sample without replacement when possible
    const indices = all.map((_, i) => i)
    const shuffledIdx = shuffleArray(indices)
    const selected = []
    if (shuffledIdx.length >= num) {
      for (let i = 0; i < num; i++) selected.push(all[shuffledIdx[i]])
    } else {
      // take all then fill with random picks (with replacement)
      shuffledIdx.forEach((idx) => selected.push(all[idx]))
      while (selected.length < num) {
        selected.push(all[Math.floor(Math.random() * all.length)])
      }
    }

    const mixQuiz = {
      id: `mixed-${num}-${Date.now()}`,
      title: `Random Mixed Quiz (${num} questions)` ,
      description: `Auto-generated mixed quiz (${num} questions) from ${quizzes.length} source quizzes.`,
      questions: selected.map((s) => ({ question: s.question, choices: s.choices, answerIndex: s.answerIndex })),
    }

    // start mixed quiz without modifying the URL history
    startQuiz(mixQuiz, { push: false })
  }

  useEffect(() => {
    fetch('http://localhost:4000/api/ping')
      .then((r) => r.json())
      .then((d) => setStatus(d.message))
      .catch(() => setStatus('Backend not running'))

    // load list of quizzes
    fetch('http://localhost:4000/api/quizzes')
      .then((r) => r.json())
      .then((data) => setQuizzes(data))
      .catch(() => setQuizzes([]))

    // If the URL is /quiz/<id> on load, fetch that quiz and open it
    const p = window.location.pathname || '/'
    if (p.startsWith('/quiz/')) {
      const id = p.slice('/quiz/'.length)
      fetch(`http://localhost:4000/api/quizzes/${id}`)
        .then((r) => r.json())
        .then((q) => {
          if (!q || q.error) return
          // load quiz and ensure any previous submission state is cleared
          setCurrentQuiz(q)
          setDisplayQuiz(prepareDisplayQuiz(q))
          setSubmitted(false)
          setScore(null)
          setAnswers({})
        })
        .catch(() => {})
    }

    // handle back/forward navigation
    const onPop = () => {
      const path = window.location.pathname || '/'
      if (path.startsWith('/quiz/')) {
        const id = path.slice('/quiz/'.length)
        fetch(`http://localhost:4000/api/quizzes/${id}`)
          .then((r) => r.json())
          .then((q) => {
            // load quiz into view and clear submission state
            setCurrentQuiz(q)
            setDisplayQuiz(prepareDisplayQuiz(q))
            setSubmitted(false)
            setScore(null)
            setAnswers({})
          })
          .catch(() => {
            setCurrentQuiz(null)
            setDisplayQuiz(null)
          })
      } else {
        // leaving quiz view — clear current quiz and submission state
        setCurrentQuiz(null)
        setDisplayQuiz(null)
        setSubmitted(false)
        setScore(null)
        setAnswers({})
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  

  

  function startQuiz(q, opts = { push: true }) {
    // navigate to /quiz/<id> only when push is enabled
    if (opts && opts.push !== false) {
      const url = `/quiz/${q.id}`
      window.history.pushState({}, '', url)
    }
    // set quiz and ensure any previous submission/score/answers are cleared
    setCurrentQuiz(q)
    setDisplayQuiz(prepareDisplayQuiz(q))
    setAnswers({})
    setSubmitted(false)
    setScore(null)
  }

  function selectAnswer(qIndex, idx) {
    setAnswers((s) => ({ ...s, [qIndex]: idx }))
  }

  function scoreQuiz() {
    const active = displayQuiz || currentQuiz
    if (!active) return 0
    let correct = 0
    ;(displayQuiz ? displayQuiz.questions : currentQuiz.questions).forEach((q, i) => {
      const correctIndex = displayQuiz ? q.correctIndex : q.answerIndex
      if (safelyNumber(answers[i]) === correctIndex) correct++
    })
    return correct
  }

  function handleSubmit() {
    const s = scoreQuiz()
    setScore(s)
    setSubmitted(true)
  }

  function handleRetry() {
    setAnswers({})
    setSubmitted(false)
    setScore(null)
    // reshuffle
    if (currentQuiz) setDisplayQuiz(prepareDisplayQuiz(currentQuiz))
  }

  function safelyNumber(v) {
    if (v === undefined || v === null) return -1
    return Number(v)
  }

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 20 }}>
      <h1>Quiz App</h1>

      <section style={{ marginTop: 20 }}>
        <h3>Tidligere eksamener</h3>
        {quizzes.length === 0 && <p>No quizzes available</p>}
        <ul>
          {quizzes.map((q) => (
            <li key={q.id}>
              <strong>{q.title}</strong>{' '}
              <button onClick={() => startQuiz(q)}>Start</button>
            </li>
          ))}
        </ul>
      </section>

      
      <section style={{ marginTop: 20 }}>
        <h3>Generer ny quiz</h3>
        <p>Bruk spørsmålene fra de gamle quizene til å lage en helt ny quiz for å få mer øving. Spørsmålene fra både kahooten og alle tidligere eksamener tas i bruk. <br></br>       
        Lengden på quizen er 25 spørsmål for å emulere eksamen.</p>
        <div style={{ marginBottom: 8 }}>
          <button onClick={() => generateMixedQuiz(25)}>Generer tilfeldig quiz</button>
        </div>
      </section>
      

      <section style={{ marginTop: 20 }}>
        <h2>Quiz Player</h2>
        {currentQuiz ? (
          <div>
            <h3>{currentQuiz.title}</h3>
            {currentQuiz.description && (
              <div style={{ color: '#444', marginBottom: 8 }}>
                <em>{currentQuiz.description}</em>
              </div>
            )}
            <ol>
              {(displayQuiz ? displayQuiz.questions : currentQuiz.questions).map((q, i) => {
                const correctIndex = displayQuiz ? q.correctIndex : q.answerIndex
                const selected = answers[i]
                return (
                  <li key={i} style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 'bold' }}>{q.question}</div>
                    <div className="choices">
                      {(displayQuiz ? q.choices : q.choices).map((c, j) => {
                        let cls = ''
                        if (submitted) {
                          if (j === correctIndex) cls = 'choice-correct'
                          else if (selected !== undefined && Number(selected) === j && j !== correctIndex) cls = 'choice-incorrect'
                        }
                        return (
                          <label key={j} className={cls} style={{ display: 'block' }}>
                            <input
                              type="radio"
                              name={`q-${i}`}
                              checked={safelyNumber(answers[i]) === j}
                              onChange={() => selectAnswer(i, j)}
                              disabled={submitted}
                            />{' '}
                            {c}
                          </label>
                        )
                      })}
                    </div>
                    {submitted && selected !== undefined && Number(selected) !== correctIndex && (
                      <div style={{ color: '#92400e', marginTop: 6 }}>Riktig svar: <strong>{(displayQuiz ? q.choices[correctIndex] : currentQuiz.questions[i].choices[correctIndex])}</strong></div>
                    )}
                    {submitted && selected === undefined && (
                      <div style={{ color: '#92400e', marginTop: 6 }}>Ingen svar valgt. Riktig svar: <strong>{(displayQuiz ? q.choices[correctIndex] : currentQuiz.questions[i].choices[correctIndex])}</strong></div>
                    )}
                  </li>
                )
              })}
            </ol>
            <div>
              {!submitted ? (
                <>
                  <button onClick={handleSubmit}>Submit</button>{' '}
                  <button
                    onClick={() => {
                      // go back to root route
                      window.history.pushState({}, '', '/')
                      setCurrentQuiz(null)
                      setDisplayQuiz(null)
                    }}
                  >
                    Back
                  </button>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 8 }}>
                    Resultat: <strong>{score} / { (displayQuiz ? displayQuiz.questions.length : currentQuiz.questions.length) }</strong>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    {/** Determine and display estimated grade */}
                    <strong>Estimert karakter: {determineGrade(score, (displayQuiz ? displayQuiz.questions.length : currentQuiz.questions.length))}</strong>
                  </div>

                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: '0.95rem', color: '#374151', marginBottom: 6 }}>Karaktergrenser (prosent):</div>
                    <ul style={{ margin: 0, paddingLeft: 14 }}>
                      {GRADE_RANGES.map((r) => {
                        const total = (displayQuiz ? displayQuiz.questions.length : currentQuiz.questions.length)
                        const minPct = percent(r.min, 45) * (total / 45) // scale percent by total
                        const maxPct = percent(r.max, 45) * (total / 45)
                        // Instead of scaling percent twice, compute directly
                        const minPctDirect = percent(r.min * (total / 45), total)
                        const maxPctDirect = percent(r.max * (total / 45), total)
                        return (
                          <li key={r.grade} style={{ color: '#374151' }}>
                            {r.grade}: {formatPct(minPctDirect)} - {formatPct(maxPctDirect)}
                          </li>
                        )
                      })}
                    </ul>
                  </div>

                  <button onClick={handleRetry} className="btn-secondary">Retry (reshuffle)</button>{' '}
                  <button
                    onClick={() => {
                      window.history.pushState({}, '', '/')
                      setCurrentQuiz(null)
                      setDisplayQuiz(null)
                      setSubmitted(false)
                      setScore(null)
                    }}
                  >
                    Back
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <p>Select a quiz to start.</p>
        )}
      </section>
    </div>
  )
}
