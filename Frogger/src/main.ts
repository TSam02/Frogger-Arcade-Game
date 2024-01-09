import { BehaviorSubject, fromEvent, interval, merge} from 'rxjs'; 
import { map, filter, scan, takeWhile,} from 'rxjs/operators';
import "./style.css";

function main() {
  /**
   * Inside this function you will use the classes and functions from rx.js
   * to add visuals to the svg element in pong.html, animate them, and make them interactive.
   *
   * Study and complete the tasks in observable examples first to get ideas.
   *
   * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
   *
   * You will be marked on your functional programming style
   * as well as the functionality that you implement.
   *
   * Document your code!
   */

  /**
   * This is the view for your game to add and update your game elements.
   */
  const svg = document.querySelector("#svgCanvas") as SVGElement & HTMLElement;

/*=====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====     DECLARATION OF CONSTANT USED    ======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx====== */
  const
    Constants = {
      FROG_START_X: 250,
      FROG_START_Y: 560,
      FROG_WIDTH: 35,
      FROG_HEIGHT: 40,
/* --------------------------- */
      CAR_STARTING_Y:505,
      CAR_WIDTH: 45,
      CAR_HEIGHT: 50,
      CAR_ROW_SPACING: 100,
      START_CAR_COUNT: 4,
/* --------------------------- */
      TRUCK_STARTING_Y:351,
      TRUCK_WIDTH: 100,
      TRUCK_HEIGHT: 50,
      TRUCK_ROW_SPACING: 80,
      START_TRUCK_COUNT: 3,
/* --------------------------- */
      LTRUCK_STARTING_Y:404,
      LTRUCK_WIDTH: 150,
      LTRUCK_HEIGHT: 55,
      LTRUCK_ROW_SPACING: 120,
      START_LTRUCK_COUNT: 2,
/* --------------------------- */
      RIVER_OBJ_HEIGHT: 25,
      SBLOCK_STARTING_Y:278,
      SBLOCK_WIDTH: 60,
      SBLOCK_ROW_SPACING: 80,
      START_SBLOCK_COUNT: 4,
/* --------------------------- */
      MBLOCK_STARTING_Y:228,
      MBLOCK_WIDTH: 90,
      MBLOCK_ROW_SPACING: 60,
      START_MBLOCK_COUNT: 4,
/* --------------------------- */
      LBLOCK_STARTING_Y:178,
      LBLOCK_WIDTH: 130,
      LBLOCK_ROW_SPACING: 80,
      START_LBLOCK_COUNT: 3,
/* --------------------------- */
      RIVER_STARTING_Y: 120,
      RIVER_WIDTH: 600,
      RIVER_HEIGHT: 189,
/* --------------------------- */
      TARGET_AREA_STARTING_Y: 15,
      TARGET_AREA_WIDTH: 50,
      TARGET_AREA_HEIGHT: 35,
      TARGET_AREA_ROW_SPACING: 55,
      START_TARGET_AREA_COUNT: 5,
/* --------------------------- */
      CROCODILE_STARTING_Y: 123,
      CROCODILE_BODY_WIDTH: 100,
      CROCODILE_HEAD_WIDTH: 30,
      START_CROCODILE_COUNT: 3,
      CROCODILE_ROW_SPACING: 70,
/* --------------------------- */
      START_FLY_COUNT: 3,
      FLY_STARTING_Y: 149,
      FLY_DIMENSION: 10,
      FLY_ROW_SPACING: 150,
/* --------------------------- */
      SPEED_UP: 0.5,
      GAME_TICK_DURATION: 10,
      TOTAL_OBS: 8,
      START_TIME: 0,
      TIME_PER_ROUND: 150,
      STARTING_LIVES: 5,
      CANVAS_SIZE: 600
    } as const;

/*=====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====          UTILITY FUNCTIONS          ======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx====== */

  /* Most of the utility functions are adapted from the tutorials and Sir Tim's Asteroids code*/
  const
    /**
     * set a number of attributes on an Element at once
     * @param e the Element
     * @param o a property bag
     */ 
    attr = (e:Element, o:{ [key:string]: Object }) =>
      { for(const k in o) e.setAttribute(k,String(o[k])) },

    /**
     * Composable not: invert boolean result of given function
     * @param f a function returning boolean
     * @param x the value that will be tested with f
     */
    not = <T>(f:(x:T)=>boolean)=> (x:T)=> !f(x),

    /**
     * is e an element of a using the eq function to test equality?
     * @param eq equality test function for two Ts
     * @param a an array that will be searched
     * @param e an element to search a for
     */
    elem = 
      <T>(eq: (_:T)=>(_:T)=>boolean)=> 
        (a:ReadonlyArray<T>)=> 
          (e:T)=> a.findIndex(eq(e)) >= 0,

    /**
     * array a except anything in b
     * @param eq equality test function for two Ts
     * @param a array to be filtered
     * @param b array of elements to be filtered out of a
     */ 
    except = 
      <T>(eq: (_:T)=>(_:T)=>boolean)=>
        (a:ReadonlyArray<T>)=> 
          (b:ReadonlyArray<T>)=> a.filter(not(elem(eq)(b))),

    /**
     * Take the first element in an array
     * @param a array where the first element to be retrieved
     */ 
    retrieveFst = 
      <T>(a:ReadonlyArray<T>): T => a[0],

    /**
     * Take everything in a excluding the one in b
     */ 
    cut = except((a:Body|MovingObject)=>(b: Body|MovingObject)=>a.id === b.id),

    /**
     * Check whether the array is empty or not 
     */ 
    checkElementExist = <T>(arr: ReadonlyArray<T>): boolean => arr.length > 0

    /**
     * Type guard for use in filters
     * @param input something that might be null or undefined
     */
    function isNotNullOrUndefined<T extends Object>(input: null | undefined | T): input is T {
      return input != null;
    }

  /**
   * Pure random number generator class 
   */
  class RNG {
    // LCG using GCC's constants
    readonly m = 0x80000000; // 2**31
    readonly a = 1103515245;
    readonly c = 12345;
    constructor(readonly state:number) {}
    int() { return (this.a * this.state + this.c) % this.m; }
    float() { return this.int() / (this.m - 1);} // returns in range [0,1]
    next() { return new RNG(this.int()) }
  }

  /**
   * Map the function to the seq and output another LazySequence with output value of function
   * @param func function that applied on the value of LazySequence
   * @param seq LazySequence that we are going to map the function on 
   */
  function mapLazy<T, V>(func: (v: T) => V, seq: LazySequence<T>): LazySequence<V> {
    return {
      value: func(seq.value),
      next: () => mapLazy(func, seq.next())
    }
   }
   
   /**
    * Creates a sequence of finite length (terminated by undefined) from a longer or infinite sequence.
    * Take returns a sequence that contains the specified number of elements of the sequence, and then 'undefined'.
    * That is, the next attribute of the last element in the returned sequence, will be a function that returns 'undefined'.
    *
    * @param n number of elements to return before returning undefined
    * @param seq the sequence
    */
   function take<T>(n: number, seq: LazySequence<T>): LazySequence<T> | undefined {
     if (n <= 0) {
       return undefined;
     }
     return {
       value: seq.value,
       next: () => take(n - 1, seq.next()) as LazySequence<T>,
     };
   }
   
   /**
    * reduce a finite sequence to a value using the specified aggregation function
    * @param func aggregation function
    * @param seq either a sequence or undefined if we have reached the end of the sequence
    * @param start starting value of the reduction past as first parameter to first call of func
    */
   function reduce<T, V>(func: (_: V, x: T) => V, seq: LazySequence<T> | undefined, start: V): V {
     return seq ? reduce(func, seq.next(), func(start, seq.value)) : start
   }


/*=====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====               CLASSES               ======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx====== */

  class Jump {constructor(public readonly pos: Vec) {}}
  class Tick { constructor(public readonly elapsed:number) {} }
  class Restart {constructor() {}}
  class Vec {constructor(public readonly x: number = 0, public readonly y: number = 0) {}} //Store coordinate

/*=====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====               TYPES                 ======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx====== */

  type Event = 'keydown' | 'keyup'
  type Key = 'KeyW' | 'KeyA' | 'KeyS' | 'KeyD' | 'KeyR'
  type ViewType = 'frog' | 'car' | 'truck' | 'longTruck' | 'shortPlank' | 'midPlank' | 'longPlank' | 'river' | 'targetArea' | 'crocodileBody' | 'crocodileHead' | 'fly'

  // Every object participates in physics is a body
  type Body = Readonly<{    
    id: string,
    viewType: ViewType,
    pos: Vec,
    width: number,
    height: number,
  }>

  // Everything that move with some speed is moving object
  interface IMovingObject extends Body {speed: number}
  type MovingObject = Readonly<IMovingObject>

  interface LazySequence<T> {
    value: T;
    next():LazySequence<T>;
  }
  
  // storing the state in a local object (update it when necessary)
  type State = Readonly<{
    time: number,
    startTime: number,
    roundTime: number,
    frog: Body,
    cars: ReadonlyArray<MovingObject>,
    trucks: ReadonlyArray<MovingObject>,
    long_trucks: ReadonlyArray<MovingObject>,
    planks: ReadonlyArray<MovingObject>,
    river: Body,
    targetAreas: ReadonlyArray<Body>,
    landed_targetAreas: ReadonlyArray<Body>,
    crocodile_bodies: ReadonlyArray<MovingObject>,
    crocodile_heads: ReadonlyArray<MovingObject>,
    flies: ReadonlyArray<MovingObject>,
    eaten: boolean,
    levelUp: boolean,
    level: number,
    targetEmpty: boolean,
    lives: number,
    died: boolean,
    score: number,
    highScore: number,
    exit: ReadonlyArray<Body>,
    gameOver: boolean
  }>

/*=====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  ===== THE ONLY IMPURITY CODE OUTSIDE OF UPDATE VIEW ======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx====== 
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======*/

  // random numbers lazy sequence (to retrieve the random numbers)
  function randomNumbers():LazySequence<number> {
    return function _next(v:RNG): LazySequence<number> {
      return {
        value: v.float(),
        next: () => _next(v.next())
      }
    }(new RNG(Math.random()))  // Only impurity in the code to determine the seed (necessary to ensure that when we reuse the randomNumbers lazy Sequence, we will get the random starting point)
  }

  // equation that convert the result to [-3, 3]
  function extendNumBoundary(n:number) {return 3-6*n} 
  // An array that store the random number generated
  const randomNumbersArray = reduce((acc:number[], n:number) => [...acc, n], take(Constants.TOTAL_OBS, mapLazy(extendNumBoundary, randomNumbers())), [])

/*=====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====     INITIALISATION OF THE GAME      ======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx====== */

  const 
    // Create the frog
    createFrog = () => 
      <Body>{
        id: "frog",
        viewType: 'frog',
        pos: new Vec(Constants.FROG_START_X, Constants.FROG_START_Y),
        width: Constants.FROG_WIDTH,
        height: Constants.FROG_HEIGHT
      },

    // create the <Body>Object
    createBody = (viewType: ViewType) => (obj_id: number) => (pos: Vec) => (width:number) => (height:number) =>
    <Body>{
      id: viewType + obj_id,
      viewType: viewType,
      pos: pos,
      width: width,
      height: height,
    },

    // Arrow function that create the any of the moving objects 
    createMovingObj = (speed:number) => (body: Body) => 
      <MovingObject>{
        ...body,
        speed: speed
      },

    // Build a starter pack of <Body>Objects
    buildStarterBodies = (obs_amount:number) => (obs_viewType:ViewType) => (obs_width:number) => 
    (obs_row_spacing:number) => (obs_starting_y:number) => (obs_height:number):ReadonlyArray<Body> => 
      [...Array(obs_amount)]
      .map((_,i) => createBody(obs_viewType)(i)
        (new Vec((i+1) * (obs_width + obs_row_spacing), obs_starting_y))
        (obs_width)(obs_height)),

    // Function for creation of a starter pack of moving objects (many of the same type)
    buildStarterMovingObj = (body_arr:ReadonlyArray<Body>)=> (obs_speed:number) => 
      body_arr.map(createMovingObj(obs_speed)),

    // function to align the head and the body of the crocodile
    alignHeadBody = (head:MovingObject, index:number):MovingObject => {
      const x = (index + 1) * (Constants.CROCODILE_BODY_WIDTH + Constants.CROCODILE_ROW_SPACING)
      return {...head,
      pos: new Vec(x, head.pos.y)}
    },


    // Build the starter pack of the objects
    startCars = 
    buildStarterMovingObj(
      buildStarterBodies(Constants.START_CAR_COUNT)("car")(Constants.CAR_WIDTH)(Constants.CAR_ROW_SPACING)
      (Constants.CAR_STARTING_Y)(Constants.CAR_HEIGHT))(randomNumbersArray[0]),
    
    startTrucks = 
    buildStarterMovingObj(
      buildStarterBodies(Constants.START_TRUCK_COUNT)("truck")(Constants.TRUCK_WIDTH)(Constants.TRUCK_ROW_SPACING)
        (Constants.TRUCK_STARTING_Y)(Constants.TRUCK_HEIGHT))(randomNumbersArray[1]),
    
    startLTrucks = 
    buildStarterMovingObj(
    buildStarterBodies(Constants.START_LTRUCK_COUNT)("longTruck")(Constants.LTRUCK_WIDTH)(Constants.LTRUCK_ROW_SPACING)
      (Constants.LTRUCK_STARTING_Y)(Constants.LTRUCK_HEIGHT))(randomNumbersArray[2]),
    
    startSblocks = 
    buildStarterMovingObj(
    buildStarterBodies(Constants.START_SBLOCK_COUNT)("shortPlank")(Constants.SBLOCK_WIDTH)(Constants.SBLOCK_ROW_SPACING)
    (Constants.SBLOCK_STARTING_Y)(Constants.RIVER_OBJ_HEIGHT))(randomNumbersArray[3]),
    
    startMblocks= 
    buildStarterMovingObj(
    buildStarterBodies(Constants.START_MBLOCK_COUNT)("midPlank")(Constants.MBLOCK_WIDTH)(Constants.MBLOCK_ROW_SPACING)
    (Constants.MBLOCK_STARTING_Y)(Constants.RIVER_OBJ_HEIGHT))(randomNumbersArray[4]),
    
    startLblocks = 
    buildStarterMovingObj(
    buildStarterBodies(Constants.START_LBLOCK_COUNT)("longPlank")(Constants.LBLOCK_WIDTH)(Constants.LBLOCK_ROW_SPACING)
    (Constants.LBLOCK_STARTING_Y)(Constants.RIVER_OBJ_HEIGHT))(randomNumbersArray[5]),
    
    river = createBody('river')(0)(new Vec(0, Constants.RIVER_STARTING_Y))(Constants.RIVER_WIDTH)(Constants.RIVER_HEIGHT),
    
    targetAreas =
    buildStarterBodies(Constants.START_TARGET_AREA_COUNT)('targetArea')(Constants.TARGET_AREA_WIDTH)(Constants.TARGET_AREA_ROW_SPACING)
    (Constants.TARGET_AREA_STARTING_Y)(Constants.TARGET_AREA_HEIGHT),
    
    startCrocBodies = 
    buildStarterMovingObj(
      buildStarterBodies(Constants.START_CROCODILE_COUNT)("crocodileBody")(Constants.CROCODILE_BODY_WIDTH)(Constants.CROCODILE_ROW_SPACING)
      (Constants.CROCODILE_STARTING_Y)(Constants.RIVER_OBJ_HEIGHT))(randomNumbersArray[6]),
    
    startCrocHeads = 
    buildStarterMovingObj(
      buildStarterBodies(Constants.START_CROCODILE_COUNT)("crocodileHead")(Constants.CROCODILE_HEAD_WIDTH)(Constants.CROCODILE_ROW_SPACING)
      (Constants.CROCODILE_STARTING_Y)(Constants.RIVER_OBJ_HEIGHT))(randomNumbersArray[6]).map((h, i) => alignHeadBody(h, i)),
    
    startFlies =
    buildStarterMovingObj(
      buildStarterBodies(Constants.START_FLY_COUNT)("fly")(Constants.FLY_DIMENSION)(Constants.FLY_ROW_SPACING)
      (Constants.FLY_STARTING_Y)(Constants.FLY_DIMENSION))(randomNumbersArray[7]),


    // Initial state of the game
    initialState: State = {
      time: 0,
      startTime: Constants.START_TIME,
      roundTime: Constants.TIME_PER_ROUND,
      frog: createFrog(), 
      cars: startCars,
      trucks: startTrucks,
      long_trucks: startLTrucks,
      planks: startSblocks.concat(startMblocks, startLblocks), //concatinating the planks as they are doing the same routine
      river: river,
      targetAreas: targetAreas,
      landed_targetAreas: [],
      crocodile_bodies: startCrocBodies,
      crocodile_heads: startCrocHeads,
      flies: startFlies,
      eaten: false,
      levelUp: false,
      level: 1,
      targetEmpty: false,
      lives: Constants.STARTING_LIVES,
      died: false,
      score: 0,
      highScore: 0, 
      exit: [],
      gameOver: false,
    }

/*=====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====             CONTROLLER              ======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx====== */

  const 
    // keep track of the game time
    gameClock$ = interval(Constants.GAME_TICK_DURATION)
      .pipe(map(elapsed =>new Tick(elapsed))),

    keyObservable = <T>(eventName: Event, k:Key, result: () => T) =>
      fromEvent<KeyboardEvent>(document, eventName)
        .pipe(
          filter(({code})=>code === k),
          filter(({repeat})=>!repeat),
          map(result)),
  
    // Input Streams
    JumpToTheRight$ = keyObservable('keydown', 'KeyD',()=> new Jump(new Vec(30, 0))),
    JumpToTheLeft$ = keyObservable('keydown', 'KeyA',()=> new Jump(new Vec(-30, 0))),
    JumpToTheFront$ = keyObservable('keydown', 'KeyW',()=> new Jump(new Vec(0, -50))),
    JumpToTheBack$ = keyObservable('keydown', 'KeyS',()=> new Jump(new Vec(0, 50))),
    Restart$ = keyObservable('keydown', 'KeyR',()=> new Restart()),

    // Wrap the moving objects by to the other side of canvas
    torusWrap = ({x,y}: Vec):Vec => {
      const wrap = (v:number) => 
        v < 0 ? v + Constants.CANVAS_SIZE : v > Constants.CANVAS_SIZE ? v - Constants.CANVAS_SIZE : v
      return new Vec(wrap(x), wrap(y))
    },

    // return the new position of the object
    moveBy = (pos:Vec) => (x_increment:number) => (y_increment:number):Vec => {
      return new Vec(pos.x + x_increment, pos.y + y_increment)
    },

    // Check whether the frog hit the boundary (i.e. canvas size)
    boundaryChecker = ({x,y}: Vec):boolean => {
      const check = (v:number) => 
        v >= 0 && v < Constants.CANVAS_SIZE ? true : false
      return check(x) && check(y)
    },

    // Function that update the position of obstacle (Used within tick method)
    updateObsPos = (obs:MovingObject) => {
      return {...obs,
        pos: torusWrap(moveBy(obs.pos)(obs.speed)(0))
      }
    },

    // Accelerate the objects passing in 
    speedUp = (levelUp:boolean) => (obj:MovingObject):MovingObject => {
      return levelUp ? {...obj, speed: obj.speed <= 0 ? obj.speed - Constants.SPEED_UP : obj.speed+Constants.SPEED_UP} : {...obj}
    },

    // composable function that check the level up condition and perform the update of object position accordingly
    // Increase the speed of object and update (if level up)
    // Else just use the object current speed
    levelUpUpdatePos = (levelUp:boolean) => (obj:MovingObject) => updateObsPos(speedUp(levelUp)(obj)),

    // Calculate the time left for the round
    calculateTimeLeft = (state: State) => (elapsed:number) => Constants.TIME_PER_ROUND - ((elapsed + 1 - state.startTime) * 10 / 1000),

    // Detect and handle all the collision happens and do the respective tasks
    handleCollision = (state:State) => {
      const 
        bodiesCollided = ([a,b]: [Body, Body]) => {
          const
            a_BR = [a.pos.x + a.width, a.pos.y + a.height],
            b_BR = [b.pos.x + b.width, b.pos.y + b.height]
    
          // if one object is placed on the left/above of the other
          // means no collide else collide
          return a.pos.x > b_BR[0] || b.pos.x > a_BR[0] || 
                 a_BR[1] < b.pos.y || b_BR[1] < a.pos.y ? false : true
          },

        // Retrieve all the moving objects of the same type that collide with the frog
        collideObstacles = (arr: ReadonlyArray<MovingObject>) => arr.filter(obj => bodiesCollided([state.frog, obj])), 
        // Retrieve the first moving object of the same type that collide with the frog         
        firstCollideObs = (landableObs:ReadonlyArray<MovingObject>):MovingObject => retrieveFst(collideObstacles(landableObs)),  
        // composition function that check whether there is any collision occur between the frog and the moving objects of same type
        checkingAnyCollision = (arr: ReadonlyArray<MovingObject>) => checkElementExist(collideObstacles(arr)),                   
        
        moveAlong = (landedObj: MovingObject) => 
          landedObj && boundaryChecker(new Vec(state.frog.pos.x + landedObj.speed, state.frog.pos.y))?
          new Vec(state.frog.pos.x + landedObj.speed, state.frog.pos.y) : state.frog.pos,
        
        // Name of the variables are self-explanable
        frogVehiclesCollide = checkingAnyCollision(state.cars.concat(state.trucks, state.long_trucks)),  
        eatByCrocodile = checkingAnyCollision(state.crocodile_heads),  
        eatFly = checkingAnyCollision(state.flies),                                                      
        
        preyedFly = collideObstacles(state.flies),                        
        landingPlank = firstCollideObs(state.planks),                                                         
        landingCrocodile = firstCollideObs(state.crocodile_bodies),
        landingInRiver = bodiesCollided([state.frog, state.river]) && !landingPlank && !landingCrocodile ? true : false, 

        landedTargetArea = state.targetAreas.filter(ta => bodiesCollided([state.frog, ta])),                      
        landedOnTargetArea = landedTargetArea.length > 0,                                                                

        moveAlongPlank = moveAlong(landingPlank),                                                        
        moveAlongCroc = moveAlong(landingCrocodile),                                                      

        // Increment the score by 100 if land on the target area after eating the fly
        // If just landed on the target without eating fly, increment by 10, else remain the same
        score = landedOnTargetArea ? state.eaten ? state.score + 100 : state.score + 10 : state.score,
        completedLevel = cut(state.targetAreas)(landedTargetArea).length === 0 ,
        runOutOfTime = state.roundTime == 0,
        died = frogVehiclesCollide || landingInRiver || eatByCrocodile || runOutOfTime

      return <State>{
        ...state,
        frog: landedOnTargetArea ? {...state.frog, pos: new Vec(Constants.FROG_START_X, Constants.FROG_START_Y)} : //Keep track of where should the frog go
              landingPlank ? {...state.frog, pos: moveAlongPlank} : 
              landingCrocodile ? {...state.frog, pos: moveAlongCroc} : {...state.frog},
        targetAreas: cut(state.targetAreas)(landedTargetArea),
        eaten: state.eaten || eatFly ? landedOnTargetArea ? false : true : false,   
        flies: cut(state.flies)(preyedFly),
        exit: state.exit.concat(preyedFly, landedTargetArea),
        targetEmpty: completedLevel,  // Time to level up (completed all target areas)
        lives: died ? state.lives - 1 : state.lives,
        died: died,
        score: score,
        highScore: state.highScore > score ? state.highScore : score,
        gameOver: state.lives == 0
      }
    },

    // let the NPC/objects in game experience the flow of time
    tick = (currentState:State, elapsed:number) => {
      const levelUpOrNot = currentState.levelUp
      return handleCollision({...currentState,
        time: elapsed,
        roundTime: calculateTimeLeft(currentState)(elapsed),
        cars: currentState.cars.map(levelUpUpdatePos(levelUpOrNot)),
        trucks: currentState.trucks.map(levelUpUpdatePos(levelUpOrNot)),
        long_trucks: currentState.long_trucks.map(levelUpUpdatePos(levelUpOrNot)),
        planks: currentState.planks.map(levelUpUpdatePos(levelUpOrNot)),
        crocodile_bodies: currentState.crocodile_bodies.map(levelUpUpdatePos(levelUpOrNot)),
        crocodile_heads: currentState.crocodile_heads.map(levelUpUpdatePos(levelUpOrNot)),
        flies: currentState.flies.map(levelUpUpdatePos(levelUpOrNot)),
        levelUp: false
      })
    },

    // reduce the state according to the action performed/tick
    reduceState = (s:State, e:Jump|Tick|Restart):State => {
      return e instanceof Jump && boundaryChecker((moveBy(s.frog.pos)(e.pos.x)(e.pos.y))) ? {...s,
        frog: {...s.frog,
          pos: (moveBy(s.frog.pos)(e.pos.x)(e.pos.y))
        }
      } : 
      e instanceof Restart || s.died ? {...initialState, // When the Frog died or In-game restart is clicked, the level remain the same (with speed up obstacles)
        cars: s.cars, 
        trucks: s.trucks, 
        long_trucks: s.long_trucks,
        planks: s.planks, 
        crocodile_bodies: s.crocodile_bodies, 
        crocodile_heads: s.crocodile_heads,
        startTime: s.time + 2, // +2 due to the gap between last time updated and the actual startTime of the next restart
        level: s.level,
        highScore: s.highScore, 
        lives: s.lives
      } : s.targetEmpty ? {...initialState,
      startTime: s.time + 2, score: s.score, highScore: s.highScore, levelUp: true, level: s.level + 1, targetEmpty: false, lives: s.lives
      } : 
      e instanceof Tick ? tick(s, e.elapsed) : {...s}
  }
  
/*=====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====       UPDATE THE FLOW OF GAME       ======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx====== */
  const foreGL = document.getElementById("foregroundLayer")!;

  // Update the view of svg objects on the middle layer
  const updateBodyView = (image_url?:string) => (qualifiedName:string) => (obj:Body) => {
    const createBodyView = () => {
      const svg = document.getElementById("middleLayer")!;
      const v = document.createElementNS(svg.namespaceURI, qualifiedName)!;
      attr(v, {id: obj.id, width: obj.width, height: obj.height});
      if (image_url) attr(v, {href: image_url});
      v.classList.add(obj.viewType)
      svg.appendChild(v)
      return v;
    }
      const v = document.getElementById(obj.id) || createBodyView();
      attr(v, {
        x: obj.pos.x,
        y: obj.pos.y,
      })
  }

  // Update the whole game
  function updateView(s:State) {
    
    document.getElementById("score")!.innerText = `${s.score}`                  // update the scores
    document.getElementById("highScore")!.innerText = `${s.highScore}`          // update the highScore
    document.getElementById("lives")!.innerText = `${s.lives}`                  // update the number of lives
    document.getElementById("level")!.innerHTML = `${s.level}`                  // update the text view of the level
    document.getElementById("time")!.innerHTML =  `${Math.round(s.roundTime)}`  // update the timer of the game

    // update the view of the frog
    const frog = document.getElementById("frog")!;
    attr(frog, {x: s.frog.pos.x, y: s.frog.pos.y,})

    // update all the objects that physically participate in the game / create new object if it has not created before
    s.flies.forEach(updateBodyView("https://i.imgur.com/EXHklTe.png")("image"))
    s.cars.forEach(updateBodyView("https://i.imgur.com/OKiVibx.png")("image"))
    s.trucks.forEach(updateBodyView("https://i.imgur.com/6dGY9HJ.png")("image"))
    s.long_trucks.forEach(updateBodyView("https://i.imgur.com/7tHcnw0.png")("image"))
    s.planks.forEach(updateBodyView(undefined)("rect"))
    s.targetAreas.forEach(updateBodyView(undefined)("rect"))
    s.crocodile_bodies.forEach(updateBodyView(undefined)("rect"))
    s.crocodile_heads.forEach(updateBodyView(undefined)("rect"))

    // Remove the unused objects from the svg 
    s.exit.map(o=>document.getElementById(o.id))
    .filter(isNotNullOrUndefined)
    .forEach(v=>{
      try {
        document.getElementById("middleLayer")!.removeChild(v)
      } catch(e) {
        console.log("Already removed: "+v.id)
      }
    })
    
    // Print out the died message and lives left if the frog died but not game over
    if (s.died) {
      document.getElementById("lives")!.innerHTML = String(s.lives)
      const v = document.createElementNS(foreGL.namespaceURI, "text")!;
      attr(v,{
        id: "Died",
        x: Constants.CANVAS_SIZE/9,
        y: Constants.CANVAS_SIZE/5.2,
        class: "died"
      });
      v.textContent = `DIED !! ${s.lives} more lives left`
      foreGL.appendChild(v)
      setTimeout(() => foreGL.removeChild(v), 1000)
    }

    // Control what should be done during game over
    if (s.gameOver) {
      isAlive$.next(false); // changing the next emit value of the isAlive$ to false (to unsubscribe later)
      showbutton();         // show the restart button
      const v = document.createElementNS(foreGL.namespaceURI, "text")!;
      attr(v,{
        id: "gameover",
        x: Constants.CANVAS_SIZE/7,
        y: Constants.CANVAS_SIZE/2,
        class: "gameover"
      });
      v.textContent = "Game Over :(";
      foreGL.appendChild(v);
    }
  }
/*=====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====     GAME OVER RESTART HANDLING      ======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx====== */

  // Create a button, hide it and append to the svg
  const button = document.createElement('button')
  button.setAttribute('hidden', 'hidden')
  button.innerHTML = "Restart"
  document.body.append(button)

  // Function to show and hide the button
  function hideButton() {button.setAttribute('hidden', 'hidden')}
  function showbutton() {button.removeAttribute('hidden')}

  // Function to restart the game again after the game has over
  function playAgain() {
    startGame()
    hideButton()
    isAlive$.next(true) // change the value of the observable to true (inidicate game started again)
    const v = document.getElementById("gameover")!; 
    foreGL.removeChild(v)
    }

  // Create an observable to listen to the restart button
  const button$ = fromEvent(button, 'click')
  button$.subscribe(playAgain)

/*=====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====       MAIN GAME SUBSCRIPTION        ======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx======
  =====xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx====== */
  
  const isAlive$ = new BehaviorSubject(true)   // Create a new BehaviourSubject to keep track of the game over or not
  const isAlive = () => isAlive$.getValue()    // Keep track of the game state by getting the value

  // Function to start the game
  function startGame() {
    const Game$ = merge(gameClock$, JumpToTheRight$, JumpToTheLeft$, JumpToTheFront$, JumpToTheBack$, Restart$).pipe(takeWhile(isAlive),scan(reduceState, initialState))
    Game$.subscribe(updateView)
  }

  startGame()
}

// The following simply runs your main function on window load.  Make sure to leave it in place.
if (typeof window !== "undefined") {
  window.onload = () => {
    main();
  };
}

